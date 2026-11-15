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

          if (
            process.env.NODE_ENV !== 'production' &&
            typeof window !== 'undefined' &&
            window.location.search.includes('preview_mobile=1')
          ) {
            setNote({
              id: 'n1',
              project_id: activeProject.id,
              title: 'Mobile Architecture Spec',
              content: '# Mobile Architecture Notes\n\nResponsive specs for DraftPilot.',
              updated_at: new Date().toISOString(),
            });
            setTasks([
              { id: 't1', project_id: activeProject.id, title: 'Mobile Drawer', status: 'done', priority: 'high', section: 'Mobile', sort_order: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 't2', project_id: activeProject.id, title: 'Responsive Modals', status: 'todo', priority: 'medium', section: 'Mobile', sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            ]);
            return;
          }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex h-[90dvh] max-h-[90dvh] w-full max-w-3xl flex-col rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 bg-slate-900/90">
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Download className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-none">
                Export Project Context & Spec
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[180px] sm:max-w-none">
                Consolidated Markdown brief for {activeProject.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 mr-1 sm:mr-2">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition ${
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
                className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'raw'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="h-3 w-3" />
                <span>Raw</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 font-sans">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-500 py-12">
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
              className="h-full w-full min-h-[300px] resize-none bg-slate-950 p-3 sm:p-4 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none rounded-lg border border-slate-800"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800 px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-900/80">
          <div className="text-[10px] sm:text-[11px] text-slate-500 text-center sm:text-left">
            <span>Includes project metadata, notes, and full checklist status.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[40px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              {hasCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Brief</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="min-h-[40px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
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

