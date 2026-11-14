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

=== WORKFLOW PRINCIPLES: DISCUSS-FIRST, DECIDE-TO-NOTES, PENDING-TO-CHECKLIST ===
1. DISCUSS FIRST (No Premature Mutations):
   - When the user asks open-ended questions, seeks advice, or compares options (e.g., "Which is better...", "Should we use..."), DO NOT call edit_note or create_task immediately.
   - First discuss the trade-offs in chat, provide clear technical recommendations, and ask for the user's decision.

2. AGREED DECISIONS -> edit_note:
   - Only write to Project Notes (edit_note) once the user explicitly agrees, confirms an architecture decision, or asks to document/draft it.

3. UNDECIDED / OPEN ITEMS -> create_task:
   - If a topic cannot be decided yet and needs follow-up resolution, add it as an actionable decision item in the Checklist (create_task, e.g., "Decide: <topic>").
   - Also create checklist tasks when the user requests implementation plans, next steps, or todo items.

4. EXPLICIT CHANGE SUMMARIES:
   - Whenever you call tools, always provide a concise bulleted summary in your reply explicitly listing what was added, updated, checked off, or removed.

CRITICAL: For toggle_task, update_task, and delete_task, copy the exact ID from [ACTIVE CHECKLIST]. NEVER invent sequential IDs like 'task_0' or 'task_4'.`;
}

export function buildProjectSystemPrompt(projectId: string): string {
  const note = getNoteByProjectId(projectId);
  const tasks = listTasksByProjectId(projectId);

  return formatProjectContext(note?.content, tasks);
}
