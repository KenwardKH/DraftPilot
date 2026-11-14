import { NextRequest, NextResponse } from 'next/server';
import { SendMessageSchema, Message, safeParseToolCalls } from '@/lib/types/chat';
import { getProjectById } from '@/lib/db/projects';
import { listMessagesByProjectId, saveMessage } from '@/lib/db/messages';
import { resolveAiConfig } from '@/lib/ai/provider';
import { buildProjectSystemPrompt } from '@/lib/ai/context';
import { WORKSPACE_TOOLS, executeWorkspaceTool, ExecutedToolCall } from '@/lib/ai/tools';
import { createUndoSnapshot } from '@/lib/db/snapshots';
import crypto from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }
    const parseResult = SendMessageSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid message request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, content } = parseResult.data;

    const project = getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Resolve AI configuration (BYOK headers take priority, then .env.local)
    const config = resolveAiConfig(req);
    if (!config.baseUrl || !config.model || !config.apiKey) {
      return NextResponse.json(
        { error: 'MISSING_AI_CONFIG' },
        { status: 400 }
      );
    }

    // 2. Persist user message to SQLite
    saveMessage(projectId, 'user', content);

    // 3. Assemble context & message history
    const systemPrompt = buildProjectSystemPrompt(projectId);
    const pastMessages = listMessagesByProjectId(projectId);

    // Convert to OpenAI chat completion format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...pastMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            content: m.content,
            tool_call_id: m.tool_call_id || undefined,
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          const parsedTools = safeParseToolCalls(m.tool_calls);
          if (parsedTools.length > 0) {
            return {
              role: 'assistant',
              content: m.content || null,
              tool_calls: parsedTools.map((t) => ({
                id: t.id || `call_${crypto.randomUUID()}`,
                type: 'function',
                function: {
                  name: t.name,
                  arguments: JSON.stringify(t.args || {}),
                },
              })),
            };
          }
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
    ];

    // 4. Request streaming completion from AI Gateway
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          tools: WORKSPACE_TOOLS,
        }),
      });
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Connection failed';
      return NextResponse.json(
        { error: `Could not reach AI provider at ${config.baseUrl}: ${errMsg}` },
        { status: 502 }
      );
    }

    if (!upstreamResponse.ok) {
      let errorDetails = '';
      try {
        errorDetails = await upstreamResponse.text();
      } catch {}
      return NextResponse.json(
        { error: `AI Gateway returned error (${upstreamResponse.status}): ${errorDetails || upstreamResponse.statusText}` },
        { status: upstreamResponse.status }
      );
    }

    if (!upstreamResponse.body) {
      return NextResponse.json({ error: 'Upstream provider returned an empty response body' }, { status: 502 });
    }

    // 5. Stream response tokens & tool calls via Server-Sent Events (SSE)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstreamResponse.body.getReader();

    let fullAssistantContent = '';
    let isSaved = false;

    // Accumulate tool calls during stream
    interface ToolCallAccumulator {
      id: string;
      name: string;
      arguments: string;
    }

    const toolCallsList: ToolCallAccumulator[] = [];
    const indexToEntryMap = new Map<number, ToolCallAccumulator>();

    const stream = new ReadableStream({
      async pull(controller) {
        let buffer = '';

        const flushAssistantMessage = async () => {
          if (isSaved) return;
          isSaved = true;

          const executedToolCalls: ExecutedToolCall[] = [];
          const toolResultsToPersist: Array<{ toolCallId: string; content: string }> = [];
          const assistantMessageId = `msg_${crypto.randomUUID()}`;

          // Execute any accumulated tool calls
          if (toolCallsList.length > 0) {
            let snapshotId: string | undefined;
            try {
              // Pre-mutation snapshot of tasks and notes saved into undo_snapshots before executing tool batch
              snapshotId = createUndoSnapshot(projectId, assistantMessageId, 'all');
            } catch (snapErr) {
              console.error('Failed to capture undo snapshot:', snapErr);
            }

            for (const call of toolCallsList) {
              if (!call.name) continue;
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(call.arguments || '{}');
              } catch {
                parsedArgs = {};
              }

              const callId = call.id || `call_${crypto.randomUUID()}`;

              try {
                const result = await executeWorkspaceTool(projectId, call.name, parsedArgs);
                executedToolCalls.push({
                  id: callId,
                  name: call.name,
                  args: parsedArgs,
                  summary: result.summary,
                  data: result.data,
                  snapshotId,
                });

                toolResultsToPersist.push({
                  toolCallId: callId,
                  content: JSON.stringify(result.data || { success: true }),
                });
              } catch (toolErr: unknown) {
                const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool execution failed';
                executedToolCalls.push({
                  id: callId,
                  name: call.name,
                  args: parsedArgs,
                  summary: `Failed to execute ${call.name}: ${errMsg}`,
                  error: errMsg,
                  snapshotId,
                });

                // Crucial fix: always persist matching tool result even on error to prevent orphaned tool_calls
                toolResultsToPersist.push({
                  toolCallId: callId,
                  content: JSON.stringify({ error: errMsg, success: false }),
                });
              }
            }
          }

          if (!fullAssistantContent.trim() && executedToolCalls.length > 0) {
            const bulletList = executedToolCalls.map((t) => `- ${t.summary}`).join('\n');
            fullAssistantContent = `Applied the following changes to the workspace:\n\n${bulletList}`;
          }

          // 1. SAVE ASSISTANT MESSAGE FIRST so tool responses succeed it in message sequence
          // Using assistantMessageId guarantees 1:1 match with undo_snapshots.message_id
          let savedMsg: Message | null = null;
          if (fullAssistantContent.trim().length > 0 || executedToolCalls.length > 0) {
            savedMsg = saveMessage(
              projectId,
              'assistant',
              fullAssistantContent,
              executedToolCalls.length > 0 ? JSON.stringify(executedToolCalls) : null,
              null,
              assistantMessageId
            );
          }

          // 2. SAVE TOOL RESULTS AFTER ASSISTANT MESSAGE to preserve OpenAI ordering: assistant (tool_calls) -> tool
          for (const toolRes of toolResultsToPersist) {
            saveMessage(
              projectId,
              'tool',
              toolRes.content,
              null,
              toolRes.toolCallId
            );
          }

          if (executedToolCalls.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'tool_calls_executed', toolCalls: executedToolCalls })}\n\n`)
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'artifacts_updated' })}\n\n`)
            );
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', message: savedMsg })}\n\n`)
          );
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;

              const dataStr = trimmed.replace(/^data:\s*/, '');
              if (dataStr === '[DONE]') {
                await flushAssistantMessage();
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;

                // Handle text delta
                if (delta?.content) {
                  fullAssistantContent += delta.content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', content: delta.content })}\n\n`)
                  );
                }

                // Handle tool_calls delta
                if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const rawIdx = tc.index;
                    const hasExplicitIndex = typeof rawIdx === 'number';

                    if (hasExplicitIndex) {
                      const existing = indexToEntryMap.get(rawIdx);
                      // If there is an existing entry at this index, but tc introduces a NEW non-empty id that differs:
                      // Start a brand new tool call entry instead of overwriting the previous one!
                      if (existing && tc.id && existing.id && tc.id !== existing.id) {
                        const nextEntry: ToolCallAccumulator = {
                          id: tc.id,
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || '',
                        };
                        toolCallsList.push(nextEntry);
                        indexToEntryMap.set(rawIdx, nextEntry);
                      } else if (existing) {
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name += tc.function.name;
                        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                      } else {
                        const nextEntry: ToolCallAccumulator = {
                          id: tc.id || '',
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || '',
                        };
                        toolCallsList.push(nextEntry);
                        indexToEntryMap.set(rawIdx, nextEntry);
                      }
                    } else {
                      // Chunk has no index field
                      if (tc.id) {
                        const last = toolCallsList[toolCallsList.length - 1];
                        if (last && last.id === tc.id) {
                          if (tc.function?.name) last.name += tc.function.name;
                          if (tc.function?.arguments) last.arguments += tc.function.arguments;
                        } else {
                          const nextEntry: ToolCallAccumulator = {
                            id: tc.id,
                            name: tc.function?.name || '',
                            arguments: tc.function?.arguments || '',
                          };
                          toolCallsList.push(nextEntry);
                        }
                      } else {
                        const last = toolCallsList[toolCallsList.length - 1];
                        if (last) {
                          if (tc.function?.name) last.name += tc.function.name;
                          if (tc.function?.arguments) last.arguments += tc.function.arguments;
                        } else {
                          const nextEntry: ToolCallAccumulator = {
                            id: '',
                            name: tc.function?.name || '',
                            arguments: tc.function?.arguments || '',
                          };
                          toolCallsList.push(nextEntry);
                        }
                      }
                    }
                  }
                }
              } catch {
                // Ignore incomplete or malformed intermediate lines
              }
            }
          }

          // In case stream ends without explicit [DONE] marker
          await flushAssistantMessage();
          controller.close();
        } catch (streamErr: unknown) {
          const streamErrMsg = streamErr instanceof Error ? streamErr.message : 'Streaming failure';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: streamErrMsg })}\n\n`)
          );
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
        if (!isSaved && fullAssistantContent.trim().length > 0) {
          saveMessage(projectId, 'assistant', fullAssistantContent);
          isSaved = true;
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Chat processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
