import { getNoteByProjectId } from '../db/notes';
import { listTasksByProjectId } from '../db/tasks';
import type { Task } from '../types/artifact';

export function formatProjectContext(
  notesContent: string | null | undefined,
  tasks: Task[] | Array<{ id: string; title: string; status: string; priority: string; section?: string }>
): string {
  const formattedNotes = notesContent && notesContent.trim().length > 0
    ? notesContent.trim()
    : '(No notes drafted yet)';

  let formattedChecklist = '(No tasks in checklist yet)';
  if (tasks && tasks.length > 0) {
    formattedChecklist = tasks
      .map((t) => {
        let statusMark = '[ ]';
        if (t.status === 'done') statusMark = '[x]';
        else if (t.status === 'in_progress') statusMark = '[/]';

        const sectionStr = t.section && t.section !== 'General' ? ` [Section: ${t.section}]` : '';
        return `- [ID: ${t.id}] ${statusMark} (${t.priority}) ${t.title}${sectionStr}`;
      })
      .join('\n');
  }

  return `You are an expert AI software architect and technical co-pilot.
You have direct access to tools to modify the project's task checklist and notes.

=== CURRENT PROJECT STATE ===
[ACTIVE NOTES]:
${formattedNotes}

[ACTIVE CHECKLIST]:
${formattedChecklist}
=============================

Use tools whenever the user requests creating, updating, checking off, or deleting tasks, or drafting/editing documentation. Provide concise, clear, and actionable software engineering guidance.`;
}

export function buildProjectSystemPrompt(projectId: string): string {
  const note = getNoteByProjectId(projectId);
  const tasks = listTasksByProjectId(projectId);

  return formatProjectContext(note?.content, tasks);
}
