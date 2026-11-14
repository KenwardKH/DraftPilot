import { getDb } from './client';
import { Project } from '../types/project';
import crypto from 'node:crypto';

export function listProjects(): Project[] {
  const db = getDb();
  const stmt = db.prepare('SELECT id, name, description, created_at, updated_at FROM projects ORDER BY updated_at DESC');
  return stmt.all() as unknown as Project[];
}

export function getProjectById(id: string): Project | null {
  const db = getDb();
  const stmt = db.prepare('SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?');
  const project = stmt.get(id);
  return (project as unknown as Project) || null;
}

export function createProject(data: { name: string; description?: string }): Project {
  const db = getDb();
  const id = `proj_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const description = data.description || '';

  const insertProject = db.prepare(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );

  const noteId = `note_${crypto.randomUUID()}`;
  const insertNote = db.prepare(
    'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)'
  );

  // Atomic SQLite transaction
  db.exec('BEGIN TRANSACTION');
  try {
    insertProject.run(id, data.name, description, now, now);
    insertNote.run(
      noteId,
      id,
      'Project Overview',
      `# ${data.name}\n\n${description ? description + '\n\n' : ''}Project notes and architecture decisions will be tracked here.`,
      now
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    id,
    name: data.name,
    description,
    created_at: now,
    updated_at: now,
  };
}

export function updateProject(id: string, data: { name?: string; description?: string }): Project | null {
  const db = getDb();
  const existing = getProjectById(id);
  if (!existing) return null;

  const name = data.name !== undefined ? data.name : existing.name;
  const description = (data.description !== undefined ? data.description : existing.description) ?? null;
  const now = new Date().toISOString();

  const stmt = db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?');
  stmt.run(name, description, now, id);

  return {
    ...existing,
    name,
    description,
    updated_at: now,
  };
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  // Foreign key CASCADE will automatically delete associated notes, tasks, messages, undo_snapshots
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);
  return Number(result.changes) > 0;
}
