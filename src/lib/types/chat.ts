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

export const ToolCallRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  args: z.record(z.unknown()).optional(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  snapshotId: z.string().optional(),
});

export const ToolCallListSchema = z.array(ToolCallRecordSchema);
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

export function safeParseToolCalls(raw: string | null | undefined): ToolCallRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = ToolCallListSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}


