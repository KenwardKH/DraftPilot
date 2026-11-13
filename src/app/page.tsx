import React from 'react';
import { Sparkles, CheckSquare, FileText, Settings, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">Interactive AI Project Workspace</h1>
            <p className="text-xs text-slate-400">Local SQLite &bull; Hybrid 9Router / BYOK &bull; WAL Enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/60 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-800/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SQLite WAL Active</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700">
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Split-Pane Workspace Skeleton */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Pane: Chat Interface Skeleton */}
        <section className="flex w-1/2 flex-col border-r border-slate-800 bg-slate-950">
          <div className="flex h-10 items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Assistant (9Router Connected)</span>
          </div>
          <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-500">
            <div>
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-indigo-500/40" />
              <p className="text-sm font-medium text-slate-400">Ready for Project Conversation</p>
              <p className="text-xs text-slate-600 mt-1">Prompt the AI to brainstorm, break down tasks, or draft documentation.</p>
            </div>
          </div>
          <div className="border-t border-slate-800 p-3 bg-slate-900/30">
            <div className="h-10 rounded-lg border border-slate-800 bg-slate-900 px-3 flex items-center text-xs text-slate-500">
              Type your instructions here...
            </div>
          </div>
        </section>

        {/* Right Pane: Live Artifacts Skeleton */}
        <section className="flex w-1/2 flex-col bg-slate-950">
          <div className="flex h-10 items-center border-b border-slate-800 bg-slate-900/40 px-2">
            <button className="flex items-center gap-1.5 border-b-2 border-indigo-500 px-3 py-2 text-xs font-semibold text-white">
              <FileText className="h-3.5 w-3.5" />
              <span>Project Notes</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Checklist</span>
            </button>
          </div>
          <div className="flex-1 p-6 text-slate-500">
            <h2 className="text-base font-semibold text-slate-300"># Welcome to Interactive AI Project Workspace</h2>
            <p className="text-xs text-slate-400 mt-2">
              This live split-pane updates in real time as the AI calls tools to organize tasks and notes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

