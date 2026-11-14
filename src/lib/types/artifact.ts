import { z } from 'zod';

export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;
  updated_at: string;
}

export const UpdateNoteSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  content: z.string(),
  title: z.string().trim().max(100).optional(),
});

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  section: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const CreateTaskSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().trim().min(1, 'Task title is required').max(200, 'Title cannot exceed 200 characters'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  section: z.string().trim().max(50).default('General'),
});

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  section: z.string().trim().max(50).optional(),
  sort_order: z.number().int().optional(),
});

