import { getDb } from './client';
import { listTasksByProjectId } from './tasks';
import { getNoteByProjectId } from './notes';
import { UndoSnapshot, SnapshotStatePayload } from '../types/snapshot';
import crypto from 'node:crypto';

export function createUndoSnapshot(
  projectId: string,
  messageId: string,
  snapshotType: 'tasks' | 'notes' | 'all' = 'all'
): string {
  const db = getDb();
  const snapshotId = `snap_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const tasks = listTasksByProjectId(projectId);
  const note = getNoteByProjectId(projectId);

  const payload: SnapshotStatePayload = {
    tasks,
    note,
  };

  const stmt = db.prepare(
    'INSERT INTO undo_snapshots (id, project_id, message_id, snapshot_type, state_payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(snapshotId, projectId, messageId, snapshotType, JSON.stringify(payload), now);

  return snapshotId;
}

export function getUndoSnapshotById(snapshotId: string): UndoSnapshot | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, project_id, message_id, snapshot_type, state_payload, created_at FROM undo_snapshots WHERE id = ?'
  );
  const result = stmt.get(snapshotId);
  return (result as unknown as UndoSnapshot) || null;
}

export function restoreUndoSnapshot(snapshotId: string): { success: boolean; projectId: string } {
  const db = getDb();
  const snapshot = getUndoSnapshotById(snapshotId);

  if (!snapshot) {
    throw new Error(`Undo snapshot "${snapshotId}" not found`);
  }

  const { tasks, note } = JSON.parse(snapshot.state_payload) as SnapshotStatePayload;

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Restore tasks
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(snapshot.project_id);
    if (tasks && tasks.length > 0) {
      const insertTaskStmt = db.prepare(
        'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const t of tasks) {
        insertTaskStmt.run(
          t.id,
          snapshot.project_id,
          t.title,
          t.status,
          t.priority,
          t.section || 'General',
          t.sort_order ?? 0,
          t.created_at || new Date().toISOString(),
          t.updated_at || new Date().toISOString()
        );
      }
    }

    // 2. Restore notes
    if (note) {
      const existingNote = db.prepare('SELECT id FROM notes WHERE project_id = ?').get(snapshot.project_id);
      if (existingNote) {
        db.prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
          note.title,
          note.content,
          note.updated_at || new Date().toISOString(),
          note.id
        );
      } else {
        db.prepare(
          'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          note.id,
          snapshot.project_id,
          note.title,
          note.content,
          note.updated_at || new Date().toISOString()
        );
      }
    } else {
      db.prepare('DELETE FROM notes WHERE project_id = ?').run(snapshot.project_id);
    }

    // 3. Remove consumed snapshot
    db.prepare('DELETE FROM undo_snapshots WHERE id = ?').run(snapshotId);

    db.exec('COMMIT;');
    return { success: true, projectId: snapshot.project_id };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

