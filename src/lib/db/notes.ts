import { getDb } from './client';
import { Note } from '../types/artifact';
import crypto from 'node:crypto';

export function getNoteByProjectId(projectId: string): Note | null {
  const db = getDb();
  const stmt = db.prepare('SELECT id, project_id, title, content, updated_at FROM notes WHERE project_id = ? LIMIT 1');
  const result = stmt.get(projectId);
  return (result as unknown as Note) || null;
}

export function updateNote(projectId: string, content: string, title?: string): Note {
  const db = getDb();
  const existing = getNoteByProjectId(projectId);
  const now = new Date().toISOString();

  if (existing) {
    const updatedTitle = title !== undefined ? title : existing.title;
    const stmt = db.prepare('UPDATE notes SET content = ?, title = ?, updated_at = ? WHERE id = ?');
    stmt.run(content, updatedTitle, now, existing.id);

    return {
      ...existing,
      content,
      title: updatedTitle,
      updated_at: now,
    };
  } else {
    const id = `note_${crypto.randomUUID()}`;
    const newTitle = title || 'Project Notes';
    const stmt = db.prepare(
      'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, projectId, newTitle, content, now);

    return {
      id,
      project_id: projectId,
      title: newTitle,
      content,
      updated_at: now,
    };
  }
}

