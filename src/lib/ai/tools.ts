import { z } from 'zod';
import { createTask, updateTask, deleteTask, getTaskById } from '../db/tasks';
import { getNoteByProjectId, updateNote } from '../db/notes';
import { Task, Note } from '../types/artifact';

// Zod validation schemas for tools
export const CreateTaskToolSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  section: z.string().trim().default('General'),
});

export const ToggleTaskToolSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
  isCompleted: z.boolean(),
});

export const UpdateTaskToolSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
  newTitle: z.string().trim().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const DeleteTaskToolSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
});

export const EditNoteToolSchema = z.object({
  content: z.string(),
  mode: z.enum(['replace', 'append']),
});

// OpenAI-compatible tool specifications for /chat/completions
export const WORKSPACE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Add a new actionable task item to the project checklist.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Clear, concise imperative action phrase (e.g. "Setup database schema")',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level of the task (defaults to medium)',
          },
          section: {
            type: 'string',
            description: 'Category or module name (e.g. "Backend", "Auth", "UI")',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_task',
      description: 'Mark an existing task as completed or uncompleted.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The exact ID of the task to toggle (e.g. "task_...")',
          },
          isCompleted: {
            type: 'boolean',
            description: 'true to mark task as done, false for todo',
          },
        },
        required: ['taskId', 'isCompleted'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update the title or priority of an existing task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The exact ID of the task to update',
          },
          newTitle: {
            type: 'string',
            description: 'New title for the task',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'New priority level',
          },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Remove a task from the project checklist.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The exact ID of the task to delete',
          },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_note',
      description: 'Update or append content to the project Markdown notes.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Markdown content to write or append',
          },
          mode: {
            type: 'string',
            enum: ['replace', 'append'],
            description: 'replace entire note content or append new section',
          },
        },
        required: ['content', 'mode'],
      },
    },
  },
];

export type WorkspaceToolName =
  | 'create_task'
  | 'toggle_task'
  | 'update_task'
  | 'delete_task'
  | 'edit_note';

export interface ExecutedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  data?: Task | Note | { taskId: string; deleted: boolean } | null;
  error?: string;
  snapshotId?: string;
}

/**
 * Executes a single tool mutation against SQLite.
 */
export async function executeWorkspaceTool(
  projectId: string,
  toolName: string,
  rawArgs: unknown
): Promise<{ summary: string; data?: Task | Note | { taskId: string; deleted: boolean } | null }> {
  switch (toolName) {
    case 'create_task': {
      const parsed = CreateTaskToolSchema.parse(rawArgs);
      const task = createTask(projectId, {
        title: parsed.title,
        priority: parsed.priority,
        section: parsed.section,
      });
      return {
        summary: `Added task: "${task.title}"`,
        data: task,
      };
    }

    case 'toggle_task': {
      const parsed = ToggleTaskToolSchema.parse(rawArgs);
      const existing = getTaskById(parsed.taskId);
      if (!existing || existing.project_id !== projectId) {
        throw new Error(`Task ID "${parsed.taskId}" not found in current project`);
      }
      const task = updateTask(parsed.taskId, {
        status: parsed.isCompleted ? 'done' : 'todo',
      });
      if (!task) {
        throw new Error(`Failed to toggle task "${parsed.taskId}"`);
      }
      const action = parsed.isCompleted ? 'Completed' : 'Reopened';
      return {
        summary: `${action} task: "${task.title}"`,
        data: task,
      };
    }

    case 'update_task': {
      const parsed = UpdateTaskToolSchema.parse(rawArgs);
      const existing = getTaskById(parsed.taskId);
      if (!existing || existing.project_id !== projectId) {
        throw new Error(`Task ID "${parsed.taskId}" not found in current project`);
      }
      const task = updateTask(parsed.taskId, {
        title: parsed.newTitle,
        priority: parsed.priority,
      });
      if (!task) {
        throw new Error(`Failed to update task "${parsed.taskId}"`);
      }
      return {
        summary: `Updated task: "${task.title}"`,
        data: task,
      };
    }

    case 'delete_task': {
      const parsed = DeleteTaskToolSchema.parse(rawArgs);
      const existing = getTaskById(parsed.taskId);
      if (!existing || existing.project_id !== projectId) {
        throw new Error(`Task ID "${parsed.taskId}" not found in current project`);
      }
      const deleted = deleteTask(parsed.taskId);
      if (!deleted) {
        throw new Error(`Failed to delete task "${parsed.taskId}"`);
      }
      return {
        summary: `Deleted task: "${existing.title}"`,
        data: { taskId: parsed.taskId, deleted: true },
      };
    }

    case 'edit_note': {
      const parsed = EditNoteToolSchema.parse(rawArgs);
      let newContent = parsed.content;

      if (parsed.mode === 'append') {
        const existingNote = getNoteByProjectId(projectId);
        if (existingNote?.content && existingNote.content.trim().length > 0) {
          newContent = `${existingNote.content.trim()}\n\n${parsed.content.trim()}`;
        }
      }

      const note = updateNote(projectId, newContent);
      const action = parsed.mode === 'append' ? 'Appended to project notes' : 'Updated project notes';
      return {
        summary: action,
        data: note,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
