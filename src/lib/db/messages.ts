import { getDb } from './client';
import { Message, MessageRole } from '../types/chat';
import crypto from 'node:crypto';

export function listMessagesByProjectId(projectId: string): Message[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, project_id, role, content, tool_calls, tool_call_id, created_at FROM messages WHERE project_id = ? ORDER BY created_at ASC, id ASC'
  );
  return stmt.all(projectId) as unknown as Message[];
}

export function saveMessage(
  projectId: string,
  role: MessageRole,
  content: string,
  toolCalls?: string | null,
  toolCallId?: string | null,
  customId?: string | null
): Message {
  const db = getDb();
  const id = customId || `msg_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(
    'INSERT INTO messages (id, project_id, role, content, tool_calls, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(id, projectId, role, content, toolCalls || null, toolCallId || null, now);

  return {
    id,
    project_id: projectId,
    role,
    content,
    tool_calls: toolCalls || null,
    tool_call_id: toolCallId || null,
    created_at: now,
  };
}

export function clearMessagesByProjectId(projectId: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM messages WHERE project_id = ?');
  stmt.run(projectId);
}
