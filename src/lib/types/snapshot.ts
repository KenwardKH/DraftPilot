import { z } from 'zod';
import { Task, Note } from './artifact';

export interface UndoSnapshot {
  id: string;
  project_id: string;
  message_id: string;
  snapshot_type: 'tasks' | 'notes' | 'all';
  state_payload: string;
  created_at: string;
}

export interface SnapshotStatePayload {
  tasks: Task[];
  note: Note | null;
}

export const UndoRequestSchema = z.object({
  snapshotId: z.string().trim().min(1, 'Snapshot ID is required'),
});

export type UndoRequest = z.infer<typeof UndoRequestSchema>;

