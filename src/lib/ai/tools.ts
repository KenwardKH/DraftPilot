import { z } from 'zod';
import {
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  listTasksByProjectId,
  findTaskByTitle,
} from '../db/tasks';
import { getNoteByProjectId, updateNote } from '../db/notes';
import { Task, Note } from '../types/artifact';

// Zod validation schemas for tools
export const CreateTaskToolSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  section: z.string().trim().default('General'),
});

export const ToggleTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
    isCompleted: z.boolean(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
  });

export const UpdateTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
    newTitle: z.string().trim().min(1).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
  });

export const DeleteTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
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
            description: 'The exact ID of the task from [ACTIVE CHECKLIST] (e.g. "task_...").',
          },
          taskTitle: {
            type: 'string',
            description: 'Fallback: the exact title of the task if ID is unknown.',
          },
          isCompleted: {
            type: 'boolean',
            description: 'true to mark task as done, false for todo',
          },
        },
        required: ['isCompleted'],
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
            description: 'The exact ID of the task from [ACTIVE CHECKLIST]',
          },
          taskTitle: {
            type: 'string',
            description: 'Fallback: the title of the task if ID is unknown',
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
            description: 'The exact ID of the task from [ACTIVE CHECKLIST] to delete',
          },
          taskTitle: {
            type: 'string',
            description: 'Fallback: the title of the task to delete if ID is unknown',
          },
        },
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
 * Resolves a task by exact ID, fallback title, or sequential index hallucination.
 */
export function resolveTask(
  projectId: string,
  taskId?: string,
  taskTitle?: string
): Task | null {
  // 1. Direct ID lookup
  if (taskId) {
    const direct = getTaskById(taskId);
    if (direct && direct.project_id === projectId) {
      return direct;
    }
  }

  // 2. Exact or substring title lookup if taskTitle was provided
  if (taskTitle) {
    const byTitle = findTaskByTitle(projectId, taskTitle);
    if (byTitle) return byTitle;
  }

  // 3. Fallback: Check if taskId was actually passed as the task's title
  if (taskId) {
    const byTaskIdAsTitle = findTaskByTitle(projectId, taskId);
    if (byTaskIdAsTitle) return byTaskIdAsTitle;
  }

  // 4. Fallback: Check if taskId matches sequential index hallucination like "task_0", "task_1", "task_4"
  if (taskId) {
    const indexMatch = taskId.match(/^task_?(\d+)$/i);
    if (indexMatch) {
      const idx = parseInt(indexMatch[1], 10);
      const allTasks = listTasksByProjectId(projectId);
      // Prioritize 1-based index (e.g. task_1 = 1st task, task_4 = 4th task)
      if (idx >= 1 && idx <= allTasks.length) {
        return allTasks[idx - 1];
      }
      // Fallback to 0-based index (e.g. task_0 = 1st task)
      if (idx >= 0 && idx < allTasks.length) {
        return allTasks[idx];
      }
    }
  }

  return null;
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
      const taskToToggle = resolveTask(projectId, parsed.taskId, parsed.taskTitle);
      if (!taskToToggle) {
        throw new Error(`Task "${parsed.taskId || parsed.taskTitle}" not found in current project`);
      }
      const task = updateTask(taskToToggle.id, {
        status: parsed.isCompleted ? 'done' : 'todo',
      });
      if (!task) {
        throw new Error(`Failed to toggle task "${taskToToggle.id}"`);
      }
      const action = parsed.isCompleted ? 'Completed' : 'Reopened';
      return {
        summary: `${action} task: "${task.title}"`,
        data: task,
      };
    }

    case 'update_task': {
      const parsed = UpdateTaskToolSchema.parse(rawArgs);
      const taskToUpdate = resolveTask(projectId, parsed.taskId, parsed.taskTitle);
      if (!taskToUpdate) {
        throw new Error(`Task "${parsed.taskId || parsed.taskTitle}" not found in current project`);
      }
      const task = updateTask(taskToUpdate.id, {
        title: parsed.newTitle,
        priority: parsed.priority,
      });
      if (!task) {
        throw new Error(`Failed to update task "${taskToUpdate.id}"`);
      }
      return {
        summary: `Updated task: "${task.title}"`,
        data: task,
      };
    }

    case 'delete_task': {
      const parsed = DeleteTaskToolSchema.parse(rawArgs);
      const taskToDelete = resolveTask(projectId, parsed.taskId, parsed.taskTitle);
      if (!taskToDelete) {
        throw new Error(`Task "${parsed.taskId || parsed.taskTitle}" not found in current project`);
      }
      const deleted = deleteTask(taskToDelete.id);
      if (!deleted) {
        throw new Error(`Failed to delete task "${taskToDelete.id}"`);
      }
      return {
        summary: `Deleted task: "${taskToDelete.title}"`,
        data: { taskId: taskToDelete.id, deleted: true },
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
