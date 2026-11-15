'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types/project';
import { ProjectSidebar } from '@/components/sidebar/ProjectSidebar';
import { ArtifactPane } from '@/components/artifacts/ArtifactPane';
import { ChatPane } from '@/components/chat/ChatPane';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { PasscodeModal } from '@/components/modals/PasscodeModal';
import { ExportModal } from '@/components/modals/ExportModal';
import { ACTIVE_PROJECT_KEY, BYOK_SETTINGS_KEY } from '@/lib/constants';
import {
  Sparkles,
  Settings,
  ShieldCheck,
  Folder,
  Server,
  Key,
  Download,
  Menu,
  Bot,
  FileText,
  CheckSquare,
} from 'lucide-react';

type MobileTab = 'chat' | 'notes' | 'checklist';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPasscodeRequired, setIsPasscodeRequired] = useState(false);
  const [isByokActive, setIsByokActive] = useState(false);
  const [artifactsRevision, setArtifactsRevision] = useState(0);

  // Mobile navigation state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [hasNewArtifactMutation, setHasNewArtifactMutation] = useState(false);
  const [taskCounts, setTaskCounts] = useState({ total: 0, done: 0 });

  const checkByokStatus = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BYOK_SETTINGS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setIsByokActive(Boolean(parsed.isCustom));
          return;
        } catch {}
      }
    }
    setIsByokActive(false);
  };

  // Check workspace passcode status
  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        if (data.required && !data.authenticated) {
          setIsPasscodeRequired(true);
          return false;
        }
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
    }
    return true;
  };

  // Fetch projects on initial mount
  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const res = await fetch('/api/projects');
      if (res.status === 401) {
        setIsPasscodeRequired(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data.projects || []);

      // Restore active project or pick the first one
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
      if (savedId && data.projects?.some((p: Project) => p.id === savedId)) {
        setActiveProjectId(savedId);
      } else if (data.projects && data.projects.length > 0) {
        setActiveProjectId(data.projects[0].id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleUnlockSuccess = () => {
    setIsPasscodeRequired(false);
    fetchProjects();
  };

  useEffect(() => {
    const init = async () => {
      // Support mobile preview query parameter for visual verification and testing
      if (
        process.env.NODE_ENV !== 'production' &&
        typeof window !== 'undefined' &&
        window.location.search.includes('preview_mobile=1')
      ) {
        setIsPasscodeRequired(false);
        const mockProj: Project = {
          id: 'proj_default',
          name: 'Mobile MVP',
          description: 'Testing responsive layout',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProjects([mockProj]);
        setActiveProjectId('proj_default');
        setIsLoadingProjects(false);
        if (window.location.search.includes('tab=notes')) setMobileTab('notes');
        if (window.location.search.includes('tab=checklist')) setMobileTab('checklist');
        if (window.location.search.includes('drawer=1')) setIsMobileSidebarOpen(true);
        if (window.location.search.includes('export=1')) setIsExportOpen(true);
        if (window.location.search.includes('settings=1')) setIsSettingsOpen(true);
        return;
      }

      const authorized = await checkAuthStatus();
      if (authorized) {
        fetchProjects();
      }
      checkByokStatus();
    };
    init();
  }, []);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    }
  };

  const handleCreateProject = async (name: string, description?: string) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create project');
    }

    const { project } = await res.json();
    setProjects((prev) => [project, ...prev]);
    handleSelectProject(project.id);
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to rename project');
    }

    const { project } = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === projectId ? project : p)));
  };

  const handleDeleteProject = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete project');
    }

    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);

    if (activeProjectId === projectId) {
      const nextId = remaining.length > 0 ? remaining[0].id : null;
      setActiveProjectId(nextId);
      if (nextId) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, nextId);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex h-[100dvh] w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Navigation */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 sm:px-4 backdrop-blur">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open projects drawer"
            title="Projects"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="overflow-hidden min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-white truncate shrink-0">
                <span className="sm:hidden">DraftPilot</span>
                <span className="hidden sm:inline">Interactive AI Workspace</span>
              </h1>
              {activeProject && (
                <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-xs text-indigo-300 font-medium border border-slate-700/80 truncate max-w-[85px] sm:max-w-[160px]">
                  <Folder className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activeProject.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate hidden lg:block">
              {activeProject?.description || 'Local SQLite • Hybrid 9Router / BYOK • WAL Enabled'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isByokActive ? (
            <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-amber-950/60 px-2 sm:px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-800/50">
              <Key className="h-3.5 w-3.5" />
              <span>BYOK Active</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-indigo-950/60 px-2 sm:px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-800/50">
              <Server className="h-3.5 w-3.5" />
              <span>Host 9Router</span>
            </div>
          )}

          <div className="hidden xl:flex items-center gap-1.5 rounded-md bg-emerald-950/60 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-800/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SQLite WAL Active</span>
          </div>

          <button
            onClick={() => setIsExportOpen(true)}
            disabled={!activeProject}
            className="flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-1.5 rounded-lg sm:rounded-md border border-slate-700 bg-slate-800 p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
            title="Export consolidated Markdown brief"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Export Context</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-1.5 rounded-lg sm:rounded-md border border-slate-700 bg-slate-800 p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            title="AI Gateway Settings"
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Mobile Sticky Tab Bar (Chat | Notes | Checklist) */}
      <nav className="flex h-11 shrink-0 w-full items-center justify-around border-b border-slate-800 bg-slate-900/95 px-1 backdrop-blur md:hidden z-10">
        <button
          onClick={() => setMobileTab('chat')}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === 'chat'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => {
            setMobileTab('notes');
            setHasNewArtifactMutation(false);
          }}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === 'notes'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Notes</span>
          {hasNewArtifactMutation && mobileTab !== 'notes' && (
            <span className="h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-indigo-900 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          onClick={() => {
            setMobileTab('checklist');
            setHasNewArtifactMutation(false);
          }}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === 'checklist'
              ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>Checklist</span>
          {taskCounts.total > 0 && (
            <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 font-normal border border-slate-700">
              {taskCounts.done}/{taskCounts.total}
            </span>
          )}
          {hasNewArtifactMutation && mobileTab !== 'checklist' && (
            <span className="h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-indigo-900 animate-pulse ml-0.5" />
          )}
        </button>
      </nav>

      {/* Main Workspace with Collapsible Sidebar & Responsive Split/Single Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Project Navigation Sidebar */}
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          isLoading={isLoadingProjects}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Workspace Panes */}
        <main className="flex flex-1 overflow-hidden">
          {/* Left / Mobile Chat Pane */}
          <section
            className={`flex flex-col bg-slate-950 overflow-hidden ${
              mobileTab === 'chat'
                ? 'w-full md:w-1/2 border-r-0 md:border-r border-slate-800'
                : 'hidden md:flex md:w-1/2 md:border-r border-slate-800'
            }`}
          >
            <ChatPane
              activeProjectId={activeProjectId}
              projectName={activeProject?.name}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onArtifactsMutated={() => {
                setArtifactsRevision((prev) => prev + 1);
                if (mobileTab === 'chat') {
                  setHasNewArtifactMutation(true);
                }
              }}
            />
          </section>

          {/* Right / Mobile Artifacts (Notes & Checklist) */}
          <section
            className={`flex flex-col bg-slate-950 overflow-hidden ${
              mobileTab !== 'chat' ? 'w-full md:w-1/2' : 'hidden md:flex md:w-1/2'
            }`}
          >
            <ArtifactPane
              activeProjectId={activeProjectId}
              projectName={activeProject?.name}
              refreshTrigger={artifactsRevision}
              activeTab={mobileTab === 'checklist' ? 'checklist' : 'notes'}
              onTabChange={(tab) => {
                if (mobileTab !== 'chat') {
                  setMobileTab(tab);
                }
              }}
              onTaskCountsChange={setTaskCounts}
            />
          </section>
        </main>
      </div>

      {/* AI Gateway & BYOK Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChanged={checkByokStatus}
      />

      {/* Workspace Passcode Gate Modal */}
      <PasscodeModal
        isOpen={isPasscodeRequired}
        onSuccess={handleUnlockSuccess}
      />

      {/* Project Context & Spec Exporter Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeProject={activeProject}
      />
    </div>
  );
}
