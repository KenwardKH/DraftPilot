'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Message } from '@/lib/types/chat';
import { BYOK_SETTINGS_KEY } from '@/lib/constants';
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
  X,
  Square,
  Settings,
  Wrench,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckSquare,
  Pencil,
  FileText,
} from 'lucide-react';

export interface ToolCallItem {
  id: string;
  name: string;
  summary: string;
  args?: Record<string, unknown>;
  error?: string;
}

interface ChatPaneProps {
  activeProjectId: string | null;
  projectName?: string;
  onOpenSettings?: () => void;
  onArtifactsMutated?: () => void;
}

function ToolCallsDisplay({ toolCalls }: { toolCalls: ToolCallItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mb-2.5 rounded-lg border border-indigo-900/40 bg-slate-950/70 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 bg-indigo-950/30 hover:bg-indigo-950/50 transition text-left"
      >
        <div className="flex items-center gap-2 text-indigo-300 font-medium">
          <Wrench className="h-3.5 w-3.5 text-indigo-400" />
          <span>
            Executed {toolCalls.length} workspace mutation{toolCalls.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[11px]">{isExpanded ? 'Hide' : 'Details'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Summary preview when collapsed */}
      {!isExpanded && (
        <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-indigo-900/20 truncate">
          {toolCalls.map((t) => t.summary).join(' • ')}
        </div>
      )}

      {/* Full detail list when expanded */}
      {isExpanded && (
        <div className="divide-y divide-slate-800/60 p-1 border-t border-indigo-900/30">
          {toolCalls.map((tool, idx) => {
            let Icon = Wrench;
            let iconColor = 'text-indigo-400 bg-indigo-950/60 border-indigo-800/40';

            if (tool.name === 'create_task') {
              Icon = Plus;
              iconColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
            } else if (tool.name === 'toggle_task') {
              Icon = CheckSquare;
              iconColor = 'text-indigo-400 bg-indigo-950/60 border-indigo-800/40';
            } else if (tool.name === 'update_task') {
              Icon = Pencil;
              iconColor = 'text-sky-400 bg-sky-950/60 border-sky-800/40';
            } else if (tool.name === 'delete_task') {
              Icon = Trash2;
              iconColor = 'text-rose-400 bg-rose-950/60 border-rose-800/40';
            } else if (tool.name === 'edit_note') {
              Icon = FileText;
              iconColor = 'text-amber-400 bg-amber-950/60 border-amber-800/40';
            }

            return (
              <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${iconColor}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 truncate">
                  <span className={tool.error ? 'text-rose-400 font-medium' : 'text-slate-200'}>
                    {tool.summary}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChatPane({
  activeProjectId,
  projectName,
  onOpenSettings,
  onArtifactsMutated,
}: ChatPaneProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAutoScrollEnabled = useRef(true);

  // Load message history when activeProjectId changes
  useEffect(() => {
    if (!activeProjectId) {
      setMessages([]);
      return;
    }

    const fetchHistory = async () => {
      try {
        setIsLoadingHistory(true);
        setErrorMessage(null);
        const res = await fetch(`/api/chat/history?projectId=${activeProjectId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load chat history');
        }
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching messages';
        setErrorMessage(msg);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [activeProjectId]);

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    isAutoScrollEnabled.current = atBottom;
  };

  // Scroll to bottom when messages update or streaming content grows
  useEffect(() => {
    if (isAutoScrollEnabled.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streamingToolCalls]);

  // Construct BYOK request headers from localStorage
  const getByokHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(BYOK_SETTINGS_KEY);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      if (parsed.isCustom && parsed.baseUrl && parsed.apiKey && parsed.model) {
        return {
          'x-ai-base-url': parsed.baseUrl,
          'x-ai-api-key': parsed.apiKey,
          'x-ai-model': parsed.model,
        };
      }
    } catch {}
    return {};
  };

  // Send a message
  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || !activeProjectId || isStreaming) return;

    setInput('');
    setErrorMessage(null);
    isAutoScrollEnabled.current = true;

    // Optimistically add user message to UI
    const tempUserMessage: Message = {
      id: `temp_${Date.now()}`,
      project_id: activeProjectId,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingToolCalls([]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const byokHeaders = getByokHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...byokHeaders,
        },
        body: JSON.stringify({
          projectId: activeProjectId,
          content: textToSend,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || `Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No readable response body returned from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'token') {
              accumulatedText += event.content;
              setStreamingContent(accumulatedText);
            } else if (event.type === 'tool_calls_executed') {
              setStreamingToolCalls(event.toolCalls || []);
            } else if (event.type === 'artifacts_updated') {
              onArtifactsMutated?.();
            } else if (event.type === 'done') {
              // Finalize message with server-persisted message (if text/tool content exists)
              if (event.message) {
                setMessages((prev) => [...prev, event.message]);
              }
              setStreamingContent('');
              setStreamingToolCalls([]);
              setIsStreaming(false);
              return;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream error occurred');
            }
          } catch (e: unknown) {
            // Ignore parse errors on intermediate chunks unless it was an explicit error
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              console.warn('SSE parsing chunk note:', e.message);
            }
          }
        }
      }

      // If stream ended without explicit done event but accumulated content
      if (accumulatedText.trim().length > 0) {
        const fallbackMsg: Message = {
          id: `msg_${Date.now()}`,
          project_id: activeProjectId,
          role: 'assistant',
          content: accumulatedText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream deliberately aborted by user
      } else {
        const errText = err instanceof Error ? err.message : 'Chat request failed';
        setErrorMessage(errText);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingToolCalls([]);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleClearHistory = async () => {
    if (!activeProjectId) return;
    try {
      const res = await fetch(`/api/chat/history?projectId=${activeProjectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to clear history');
      setMessages([]);
      setShowClearConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear history';
      setErrorMessage(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const starterSuggestions = [
    'Break down the architecture into tracer tasks',
    'Review the project notes and suggest next milestones',
    'Draft a specification outline for our MVP',
  ];

  if (!activeProjectId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
        <Sparkles className="mb-3 h-10 w-10 text-indigo-500/30" />
        <h3 className="text-sm font-medium text-slate-400">No Project Selected</h3>
        <p className="mt-1 text-xs text-slate-600 max-w-xs">
          Select an existing project from the sidebar or create a new one to start collaborating with AI.
        </p>
      </div>
    );
  }

  // Filter out internal 'tool' role records since tool calls are rendered directly inside the assistant card
  const visibleMessages = messages.filter((m) => m.role !== 'tool');

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-950">
      {/* Chat Header Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300">
            {projectName ? `${projectName} Chat` : 'AI Project Chat'}
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
            SSE + Tools
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {showClearConfirm ? (
            <div className="flex items-center gap-1 rounded bg-rose-950/80 p-1 border border-rose-800/60">
              <span className="text-[11px] text-rose-300 font-medium px-1">Clear all?</span>
              <button
                onClick={handleClearHistory}
                className="flex h-5 w-5 items-center justify-center rounded bg-rose-600 text-white hover:bg-rose-500"
                title="Confirm clear"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            visibleMessages.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isStreaming}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                title="Clear chat history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex shrink-0 items-center justify-between border-b border-rose-900/60 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            {errorMessage === 'MISSING_AI_CONFIG' ? (
              <div className="flex items-center gap-2">
                <span>AI Gateway is not configured. Please set your credentials or BYOK.</span>
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-indigo-500 shadow-sm"
                  >
                    <Settings className="h-3 w-3" />
                    <span>Open Settings</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="line-clamp-2">{errorMessage}</p>
            )}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="rounded p-1 text-rose-400 hover:bg-rose-900/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoadingHistory ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="ml-2 text-xs">Loading message history...</span>
          </div>
        ) : visibleMessages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 mb-3">
              <Sparkles className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-medium text-slate-300">How can I help with {projectName}?</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              I can directly create, update, or check off tasks in your checklist, and draft or edit documentation in your notes.
            </p>

            <div className="mt-5 flex flex-col gap-2 w-full max-w-sm">
              {starterSuggestions.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-left text-xs text-slate-300 transition hover:border-indigo-600/60 hover:bg-slate-800/80"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => {
              let parsedTools: ToolCallItem[] = [];
              if (msg.tool_calls) {
                try {
                  parsedTools = JSON.parse(msg.tool_calls);
                } catch {}
              }

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 border border-slate-800/80 text-slate-200'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div>
                        {parsedTools.length > 0 && <ToolCallsDisplay toolCalls={parsedTools} />}
                        {msg.content && (
                          <div className="prose prose-invert prose-xs max-w-none space-y-2 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-slate-950 [&>pre]:border [&>pre]:border-slate-800 [&>pre]:p-2.5 [&>pre]:rounded-md [&>code]:bg-slate-800 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400 border border-slate-700/60">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Streaming Assistant Bubble */}
            {isStreaming && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <div className="max-w-[85%] rounded-xl bg-slate-900 border border-slate-800/80 px-4 py-3 text-xs leading-relaxed text-slate-200">
                  {streamingToolCalls.length > 0 && (
                    <ToolCallsDisplay toolCalls={streamingToolCalls} />
                  )}

                  {streamingContent ? (
                    <div className="prose prose-invert prose-xs max-w-none space-y-2 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-slate-950 [&>pre]:border [&>pre]:border-slate-800 [&>pre]:p-2.5 [&>pre]:rounded-md [&>code]:bg-slate-800 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {streamingContent}
                      </ReactMarkdown>
                      <span className="inline-block h-3.5 w-1.5 animate-pulse bg-indigo-400 align-middle ml-1" />
                    </div>
                  ) : (
                    streamingToolCalls.length === 0 && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                        <span>Thinking...</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Area */}
      <div className="border-t border-slate-800/80 bg-slate-900/50 p-3">
        <div className="relative flex flex-col rounded-xl border border-slate-800 bg-slate-950 shadow-inner focus-within:border-indigo-600/70 transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={`Message AI co-pilot about ${projectName || 'project'}... (e.g. "Add 3 tasks for auth and update notes")`}
            rows={2}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />

          <div className="flex items-center justify-between border-t border-slate-800/50 px-3 py-1.5 bg-slate-900/30">
            <span className="text-[10px] text-slate-500">
              Shift + Enter for new line
            </span>

            <div className="flex items-center gap-1.5">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="flex items-center gap-1 rounded-md bg-rose-600/80 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-rose-600"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600"
                >
                  <Send className="h-3 w-3" />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
