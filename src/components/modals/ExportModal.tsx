'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types/project';
import { Note, Task } from '@/lib/types/artifact';
import { generateContextBrief } from '@/lib/export/contextBrief';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Code2,
  Eye,
  Loader2,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: Project | null | undefined;
}

export function ExportModal({ isOpen, onClose, activeProject }: ExportModalProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (isOpen && activeProject) {
      const loadData = async () => {
        try {
          setIsLoading(true);
          const [noteRes, tasksRes] = await Promise.all([
            fetch(`/api/notes?projectId=${activeProject.id}`),
            fetch(`/api/tasks?projectId=${activeProject.id}`),
          ]);

          if (noteRes.ok) {
            const noteData = await noteRes.json();
            setNote(noteData.note);
          }
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            setTasks(tasksData.tasks || []);
          }
        } catch (err) {
          console.error('Failed to load export data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  }, [isOpen, activeProject]);

  if (!isOpen || !activeProject) return null;

  const markdownContent = generateContextBrief(activeProject, note, tasks);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const safeName = activeProject.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${safeName || 'project'}-spec.md`;

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Export Project Context & Spec</h3>
              <p className="text-xs text-slate-400">Consolidated Markdown brief for {activeProject.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 mr-2">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'preview'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'raw'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="h-3 w-3" />
                <span>Raw Markdown</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-sans">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="ml-2 text-xs">Generating project brief...</span>
            </div>
          ) : viewMode === 'preview' ? (
            <article className="prose prose-invert prose-xs max-w-none space-y-4 text-slate-200 [&>h1]:text-lg [&>h1]:font-bold [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:border-b [&>h2]:border-slate-800 [&>h2]:pb-1.5 [&>h3]:text-xs [&>h3]:font-medium [&>ul]:list-disc [&>ul]:pl-4 [&>blockquote]:border-l-2 [&>blockquote]:border-indigo-500 [&>blockquote]:bg-slate-900/40 [&>blockquote]:p-2.5 [&>blockquote]:rounded-r">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {markdownContent}
              </ReactMarkdown>
            </article>
          ) : (
            <textarea
              readOnly
              value={markdownContent}
              className="h-full w-full resize-none bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none rounded-lg border border-slate-800"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-slate-900/60">
          <div className="text-[11px] text-slate-500">
            <span>Includes project metadata, notes, and full checklist status.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              {hasCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .md</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
