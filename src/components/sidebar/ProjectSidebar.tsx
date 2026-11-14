'use client';

import React, { useState } from 'react';
import { Project } from '@/lib/types/project';
import {
  Folder,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, description?: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  isLoading: boolean;
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  isLoading,
}: ProjectSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setFormError('Project name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await onCreateProject(newProjectName.trim(), newProjectDesc.trim());
      setNewProjectName('');
      setNewProjectDesc('');
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <aside
        className={`relative flex flex-col border-r border-slate-800 bg-slate-900/90 backdrop-blur transition-all duration-200 ${
          isCollapsed ? 'w-14' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-12 items-center justify-between border-b border-slate-800 px-3">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Projects ({projects.length})
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {!isCollapsed && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                title="Create New Project"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Collapsed State: Quick Add Button */}
        {isCollapsed && (
          <div className="p-2 border-b border-slate-800 flex justify-center">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              title="Create New Project"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            !isCollapsed && (
              <div className="p-4 text-center text-xs text-slate-500">
                No projects found. Create one to get started!
              </div>
            )
          ) : (
            projects.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <div
                  key={project.id}
                  className={`group relative flex items-center rounded-lg transition ${
                    isActive
                      ? 'bg-indigo-600/15 text-white font-medium border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  } ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2'}`}
                >
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="flex flex-1 items-center gap-2.5 overflow-hidden text-left"
                    title={project.name}
                  >
                    {isActive ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-indigo-400" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                    )}

                    {!isCollapsed && (
                      <div className="truncate">
                        <span className="block truncate text-xs">{project.name}</span>
                        {project.description && (
                          <span className="block truncate text-[10px] text-slate-500 font-normal">
                            {project.description}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {!isCollapsed && projects.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      title="Delete Project"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Create New Project</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-950/50 border border-rose-800/60 p-2.5 text-xs text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., E-Commerce MVP, Auth Refactor"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description <span className="text-slate-500">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Short summary of project goals and scope..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-rose-900/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="rounded-full bg-rose-950 p-2 border border-rose-800/50">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Delete Project</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-200">"{projectToDelete.name}"</span>?
              This will permanently delete all associated chat messages, notes, and checklist tasks.
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
