import { z } from 'zod';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().default(''),
});

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

