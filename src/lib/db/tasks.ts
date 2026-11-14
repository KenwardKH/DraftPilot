import { getDb } from './client';
import { Task, TaskPriority, TaskStatus } from '../types/artifact';
import crypto from 'node:crypto';

export function listTasksByProjectId(projectId: string): Task[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, project_id, title, status, priority, section, sort_order, created_at, updated_at FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC'
  );
  return stmt.all(projectId) as unknown as Task[];
}

export function getTaskById(taskId: string): Task | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, project_id, title, status, priority, section, sort_order, created_at, updated_at FROM tasks WHERE id = ?'
  );
  const result = stmt.get(taskId);
  return (result as unknown as Task) || null;
}

export function createTask(
  projectId: string,
  data: { title: string; priority?: TaskPriority; section?: string }
): Task {
  const db = getDb();
  const id = `task_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const priority = data.priority || 'medium';
  const section = data.section || 'General';

  // Get max sort_order
  const maxStmt = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM tasks WHERE project_id = ?');
  const maxRes = maxStmt.get(projectId) as { maxOrder: number | bigint };
  const sortOrder = Number(maxRes.maxOrder) + 1;

  const insertStmt = db.prepare(
    'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertStmt.run(id, projectId, data.title, 'todo', priority, section, sortOrder, now, now);

  return {
    id,
    project_id: projectId,
    title: data.title,
    status: 'todo',
    priority,
    section,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };
}

export function updateTask(
  taskId: string,
  data: {
    title?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    section?: string;
    sort_order?: number;
  }
): Task | null {
  const db = getDb();
  const existing = getTaskById(taskId);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const status = data.status !== undefined ? data.status : existing.status;
  const priority = data.priority !== undefined ? data.priority : existing.priority;
  const section = data.section !== undefined ? data.section : existing.section;
  const sortOrder = data.sort_order !== undefined ? data.sort_order : existing.sort_order;
  const now = new Date().toISOString();

  const stmt = db.prepare(
    'UPDATE tasks SET title = ?, status = ?, priority = ?, section = ?, sort_order = ?, updated_at = ? WHERE id = ?'
  );
  stmt.run(title, status, priority, section, sortOrder, now, taskId);

  return {
    ...existing,
    title,
    status,
    priority,
    section,
    sort_order: sortOrder,
    updated_at: now,
  };
}

export function deleteTask(taskId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const result = stmt.run(taskId);
  return Number(result.changes) > 0;
}

