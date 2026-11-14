'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types/project';
import { ProjectSidebar } from '@/components/sidebar/ProjectSidebar';
import { ArtifactPane } from '@/components/artifacts/ArtifactPane';
import { ChatPane } from '@/components/chat/ChatPane';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ACTIVE_PROJECT_KEY, BYOK_SETTINGS_KEY } from '@/lib/constants';
import { Sparkles, Settings, ShieldCheck, Folder, Server, Key } from 'lucide-react';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isByokActive, setIsByokActive] = useState(false);
  const [artifactsRevision, setArtifactsRevision] = useState(0);

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

  // Fetch projects on initial mount
  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const res = await fetch('/api/projects');
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

  useEffect(() => {
    fetchProjects();
    checkByokStatus();
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
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Header Navigation */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-white">Interactive AI Project Workspace</h1>
              {activeProject && (
                <span className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs text-indigo-300 font-medium border border-slate-700/80">
                  <Folder className="h-3 w-3" />
                  {activeProject.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {activeProject?.description || 'Local SQLite &bull; Hybrid 9Router / BYOK &bull; WAL Enabled'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isByokActive ? (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-800/50">
              <Key className="h-3.5 w-3.5" />
              <span>BYOK Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-indigo-950/60 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-800/50">
              <Server className="h-3.5 w-3.5" />
              <span>Host 9Router</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/60 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-800/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SQLite WAL Active</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Workspace with Collapsible Sidebar */}
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
        />

        {/* Split-Pane Area */}
        <main className="flex flex-1 overflow-hidden">
          {/* Left Pane: Chat Interface */}
          <section className="flex w-1/2 flex-col border-r border-slate-800 bg-slate-950 overflow-hidden">
            <ChatPane
              activeProjectId={activeProjectId}
              projectName={activeProject?.name}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onArtifactsMutated={() => setArtifactsRevision((prev) => prev + 1)}
            />
          </section>

          {/* Right Pane: Live Artifacts (Notes & Checklist) */}
          <section className="flex w-1/2 flex-col bg-slate-950 overflow-hidden">
            <ArtifactPane
              activeProjectId={activeProjectId}
              projectName={activeProject?.name}
              refreshTrigger={artifactsRevision}
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
    </div>
  );
}
