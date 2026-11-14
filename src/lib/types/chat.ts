import { z } from 'zod';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  tool_calls?: string | null;
  tool_call_id?: string | null;
  created_at: string;
}

export const SendMessageSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  content: z.string().trim().min(1, 'Message content cannot be empty'),
});

export const ChatHistoryQuerySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

export const DeleteChatHistorySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

