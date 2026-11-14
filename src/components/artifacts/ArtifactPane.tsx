'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, Task, TaskPriority, TaskStatus } from '@/lib/types/artifact';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  FileText,
  CheckSquare,
  Edit3,
  Eye,
  Columns,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Save,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface ArtifactPaneProps {
  activeProjectId: string | null;
  projectName?: string;
  refreshTrigger?: number;
}

type ViewMode = 'edit' | 'split' | 'preview';
type TaskFilter = 'all' | 'todo' | 'done';

export function ArtifactPane({ activeProjectId, projectName, refreshTrigger }: ArtifactPaneProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'checklist'>('notes');

  // Notes state
  const [note, setNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Visual diff highlighting state
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<Set<string>>(new Set());
  const [isNoteHighlighted, setIsNoteHighlighted] = useState(false);
  const currentProjectIdRef = useRef<string | null>(null);
  const prevTasksRef = useRef<Map<string, { status: string; title: string }>>(new Map());
  const prevNoteContentRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noteHighlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (noteHighlightTimerRef.current) clearTimeout(noteHighlightTimerRef.current);
    };
  }, []);

  // Load project artifacts when activeProjectId changes
  const loadArtifacts = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true);
      const isSameProject = currentProjectIdRef.current === projectId;
      currentProjectIdRef.current = projectId;

      const [noteRes, tasksRes] = await Promise.all([
        fetch(`/api/notes?projectId=${projectId}`),
        fetch(`/api/tasks?projectId=${projectId}`),
      ]);

      if (noteRes.ok) {
        const noteData = await noteRes.json();
        const newContent = noteData.note.content;

        if (isSameProject && prevNoteContentRef.current !== null && prevNoteContentRef.current !== newContent) {
          setIsNoteHighlighted(true);
          if (noteHighlightTimerRef.current) clearTimeout(noteHighlightTimerRef.current);
          noteHighlightTimerRef.current = setTimeout(() => setIsNoteHighlighted(false), 2500);
        }
        prevNoteContentRef.current = newContent;
        setNote(noteData.note);
        setNoteContent(newContent);
        setLastSavedTime(new Date(noteData.note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const newTasks: Task[] = tasksData.tasks || [];

        if (isSameProject && prevTasksRef.current.size > 0) {
          const changedIds = new Set<string>();
          for (const task of newTasks) {
            const prev = prevTasksRef.current.get(task.id);
            if (!prev || prev.status !== task.status || prev.title !== task.title) {
              changedIds.add(task.id);
            }
          }
          if (changedIds.size > 0) {
            setHighlightedTaskIds(changedIds);
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = setTimeout(() => {
              setHighlightedTaskIds(new Set());
            }, 2500);
          }
        }

        const newMap = new Map<string, { status: string; title: string }>();
        for (const t of newTasks) {
          newMap.set(t.id, { status: t.status, title: t.title });
        }
        prevTasksRef.current = newMap;
        setTasks(newTasks);
      }
    } catch (err) {
      console.error('Failed to load artifacts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadArtifacts(activeProjectId);
    } else {
      currentProjectIdRef.current = null;
      prevTasksRef.current.clear();
      prevNoteContentRef.current = null;
      setHighlightedTaskIds(new Set());
      setIsNoteHighlighted(false);
      setNote(null);
      setNoteContent('');
      setTasks([]);
    }
  }, [activeProjectId, loadArtifacts, refreshTrigger]);

  // Note auto-save handler (debounced 600ms)
  const handleContentChange = (val: string) => {
    setNoteContent(val);
    prevNoteContentRef.current = val;
    if (!activeProjectId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSavingNote(true);
        const res = await fetch('/api/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: activeProjectId, content: val }),
        });

        if (res.ok) {
          const data = await res.json();
          setNote(data.note);
          setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      } finally {
        setIsSavingNote(false);
      }
    }, 600);
  };

  // Add Task handler
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProjectId) return;

    try {
      setIsAddingTask(true);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
        }),
      });

      if (res.ok) {
        const { task } = await res.json();
        prevTasksRef.current.set(task.id, { status: task.status, title: task.title });
        setTasks((prev) => [...prev, task]);
        setNewTaskTitle('');
        setNewTaskPriority('medium');
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle Task Status (todo <-> done)
  const handleToggleTask = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';

    prevTasksRef.current.set(task.id, { status: nextStatus, title: task.title });

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.error('Failed to toggle task:', err);
      // Revert on error
      prevTasksRef.current.set(task.id, { status: task.status, title: task.title });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // Update Task Title
  const handleSaveTaskTitle = async (taskId: string) => {
    if (!editingTaskTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    const titleToSave = editingTaskTitle.trim();
    const existingTask = tasks.find((t) => t.id === taskId);
    if (existingTask) {
      prevTasksRef.current.set(taskId, { status: existingTask.status, title: titleToSave });
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: titleToSave } : t))
    );
    setEditingTaskId(null);

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToSave }),
      });
    } catch (err) {
      console.error('Failed to update task title:', err);
    }
  };

  // Delete Task handler
  const handleDeleteTask = async (taskId: string) => {
    prevTasksRef.current.delete(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Checklist counts
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'todo') return t.status !== 'done';
    if (taskFilter === 'done') return t.status === 'done';
    return true;
  });

  if (!activeProjectId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
        <div>
          <FileText className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No Active Project Selected</p>
          <p className="text-xs text-slate-600 mt-1">Select or create a project to view notes and tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
      {/* Top Tab Bar */}
      <div className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-900/60 px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('notes')}
            className={`relative flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition ${
              activeTab === 'notes'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Project Notes</span>
            {isNoteHighlighted && activeTab !== 'notes' && (
              <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-indigo-900 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`relative flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition ${
              activeTab === 'checklist'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Checklist</span>
            {highlightedTaskIds.size > 0 && activeTab !== 'checklist' && (
              <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-indigo-900 animate-pulse" />
            )}
            {totalCount > 0 && (
              <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 font-normal border border-slate-700">
                {doneCount}/{totalCount}
              </span>
            )}
          </button>
        </div>

        {/* Notes View Switcher (when Notes tab is active) */}
        {activeTab === 'notes' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mr-2">
              {isSavingNote ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                  <span>Saving...</span>
                </>
              ) : lastSavedTime ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Saved {lastSavedTime}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
              <button
                onClick={() => setViewMode('edit')}
                title="Editor Only"
                className={`p-1 rounded text-xs transition ${
                  viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                title="Split View"
                className={`p-1 rounded text-xs transition ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Columns className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode('preview')}
                title="Preview Only"
                className={`p-1 rounded text-xs transition ${
                  viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : activeTab === 'notes' ? (
          /* =============================================================== */
          /* TAB 1: MARKDOWN NOTES EDITOR & SANITIZED PREVIEW                 */
          /* =============================================================== */
          <div className="flex flex-1 overflow-hidden">
            {/* Editor Pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div
                className={`flex flex-col border-slate-800 transition-all duration-700 ${
                  viewMode === 'split' ? 'w-1/2 border-r' : 'w-full'
                } ${
                  isNoteHighlighted ? 'ring-2 ring-indigo-500/80 bg-indigo-950/20' : ''
                }`}
              >
                <textarea
                  value={noteContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Type your project notes, requirements, and decisions in Markdown..."
                  className="flex-1 resize-none bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>
            )}

            {/* Sanitized Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div
                className={`flex flex-col overflow-y-auto bg-slate-950/70 p-5 transition-all duration-700 ${
                  viewMode === 'split' ? 'w-1/2' : 'w-full'
                } ${
                  isNoteHighlighted ? 'ring-2 ring-indigo-500/80 bg-indigo-950/20' : ''
                }`}
              >
                <article className="prose prose-invert prose-xs max-w-none space-y-3 text-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                    {noteContent || '*No notes yet. Start typing on the left or prompt the AI to draft specifications!*'}
                  </ReactMarkdown>
                </article>
              </div>
            )}
          </div>
        ) : (
          /* =============================================================== */
          /* TAB 2: INTERACTIVE TASK CHECKLIST                               */
          /* =============================================================== */
          <div className="flex flex-1 flex-col overflow-hidden p-4 space-y-4">
            {/* Progress Bar & Filter Header */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Project Progress</span>
                <span className="font-mono text-indigo-400 font-semibold">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
                {(['all', 'todo', 'done'] as TaskFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`rounded-md px-2.5 py-1 text-xs capitalize transition ${
                      taskFilter === filter
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Add New Task Form */}
            <form onSubmit={handleAddTask} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a new task (press Enter)..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <button
                type="submit"
                disabled={isAddingTask || !newTaskTitle.trim()}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {isAddingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>Add</span>
              </button>
            </form>

            {/* Task Item List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <CheckSquare className="mx-auto mb-2 h-7 w-7 text-slate-600 opacity-60" />
                  <p>No tasks in this view.</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Add tasks above or ask the AI to generate a checklist.</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isDone = task.status === 'done';
                  const isEditing = editingTaskId === task.id;
                  const isHighlighted = highlightedTaskIds.has(task.id);

                  return (
                    <div
                      key={task.id}
                      className={`group flex items-center justify-between rounded-lg border p-2.5 transition-all duration-500 ${
                        isHighlighted
                          ? 'border-indigo-500 bg-indigo-950/60 shadow-[0_0_12px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500'
                          : isDone
                          ? 'border-slate-800/40 bg-slate-950/40 text-slate-500'
                          : 'border-slate-800/80 bg-slate-900/60 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {/* Checkbox & Title */}
                      <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
                        <button
                          onClick={() => handleToggleTask(task)}
                          title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                          className="shrink-0 text-slate-400 hover:text-indigo-400 transition"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-500" />
                          )}
                        </button>

                        {isEditing ? (
                          <div className="flex flex-1 items-center gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={editingTaskTitle}
                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTaskTitle(task.id);
                                if (e.key === 'Escape') setEditingTaskId(null);
                              }}
                              className="flex-1 rounded border border-indigo-500 bg-slate-950 px-2 py-0.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveTaskTitle(task.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTaskId(null)}
                              className="p-1 text-slate-500 hover:text-slate-300"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onDoubleClick={() => {
                              setEditingTaskId(task.id);
                              setEditingTaskTitle(task.title);
                            }}
                            className={`truncate text-xs ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}
                            title={task.title}
                          >
                            {task.title}
                          </span>
                        )}
                      </div>

                      {/* Priority Badge & Action Buttons */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {isHighlighted && (
                            <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300 border border-indigo-500/40 animate-pulse">
                              Updated
                            </span>
                          )}

                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium border uppercase tracking-wider ${
                              task.priority === 'high'
                                ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                                : task.priority === 'medium'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/50'
                                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                            }`}
                          >
                            {task.priority}
                          </span>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditingTaskTitle(task.title);
                              }}
                              title="Edit Title"
                              className="p-1 text-slate-500 hover:text-indigo-400 transition"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete Task"
                              className="p-1 text-slate-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

