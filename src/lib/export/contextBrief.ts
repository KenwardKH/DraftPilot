import { Project } from '../types/project';
import { Note, Task } from '../types/artifact';

export function generateContextBrief(
  project: Project,
  note: Note | null,
  tasks: Task[]
): string {
  const totalCount = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const todoTasks = tasks.filter((t) => t.status !== 'done');
  const doneCount = doneTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const notesContent = note?.content?.trim() || '*(No notes drafted yet)*';

  const todoList =
    todoTasks.length > 0
      ? todoTasks
          .map(
            (t) =>
              `- [ ] (${t.priority}) ${t.title}${
                t.section && t.section !== 'General' ? ` [${t.section}]` : ''
              }`
          )
          .join('\n')
      : '*(No pending tasks)*';

  const doneList =
    doneTasks.length > 0
      ? doneTasks
          .map(
            (t) =>
              `- [x] (${t.priority}) ${t.title}${
                t.section && t.section !== 'General' ? ` [${t.section}]` : ''
              }`
          )
          .join('\n')
      : '*(No completed tasks)*';

  return `# Project: ${project.name}
> ${project.description || 'No description provided.'}

*Exported: ${new Date().toLocaleString()} | Interactive AI Project Workspace*

---

## 1. Project Notes & Architectural Specifications

${notesContent}

---

## 2. Checklist & Implementation Status

**Progress:** ${doneCount}/${totalCount} tasks completed (${progressPercent}%)

### Pending Tasks (${todoTasks.length})
${todoList}

### Completed Tasks (${doneTasks.length})
${doneList}
`;
}
