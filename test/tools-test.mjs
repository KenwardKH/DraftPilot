import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const testDbDir = path.resolve('data');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

const testDbPath = path.resolve('data/test-tools.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

// Define schemas matching src/lib/ai/tools.ts
const CreateTaskToolSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  section: z.string().trim().default('General'),
});

const ToggleTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
    isCompleted: z.boolean(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
  });

const UpdateTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
    newTitle: z.string().trim().min(1).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
  });

const DeleteTaskToolSchema = z
  .object({
    taskId: z.string().trim().optional(),
    taskTitle: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.taskId || data.taskTitle), {
    message: 'Either taskId or taskTitle is required',
  });

const EditNoteToolSchema = z.object({
  content: z.string(),
  mode: z.enum(['replace', 'append']),
});

try {
  // 1. Test Schema Validations
  const validCreate = CreateTaskToolSchema.parse({ title: 'Build auth layer', priority: 'high' });
  if (validCreate.title !== 'Build auth layer' || validCreate.section !== 'General') {
    throw new Error('CreateTask schema validation failed');
  }

  let invalidFailed = false;
  try {
    CreateTaskToolSchema.parse({ title: '   ', priority: 'invalid_priority' });
  } catch {
    invalidFailed = true;
  }
  if (!invalidFailed) throw new Error('CreateTask should fail on invalid input');

  const validToggle = ToggleTaskToolSchema.parse({ taskId: 'task_1', isCompleted: true });
  if (!validToggle.isCompleted) throw new Error('ToggleTask schema validation failed');

  const validToggleWithTitle = ToggleTaskToolSchema.parse({ taskTitle: 'Build auth layer', isCompleted: true });
  if (validToggleWithTitle.taskTitle !== 'Build auth layer') throw new Error('ToggleTask with taskTitle validation failed');

  const validUpdateWithTitle = UpdateTaskToolSchema.parse({ taskTitle: 'Build auth layer', newTitle: 'Updated Auth' });
  if (validUpdateWithTitle.taskTitle !== 'Build auth layer') throw new Error('UpdateTask with taskTitle validation failed');

  const validDeleteWithTitle = DeleteTaskToolSchema.parse({ taskTitle: 'Build auth layer' });
  if (validDeleteWithTitle.taskTitle !== 'Build auth layer') throw new Error('DeleteTask with taskTitle validation failed');

  let invalidToggleFailed = false;
  try {
    ToggleTaskToolSchema.parse({ isCompleted: true });
  } catch {
    invalidToggleFailed = true;
  }
  if (!invalidToggleFailed) throw new Error('ToggleTask should fail if both taskId and taskTitle are missing');

  const validEdit = EditNoteToolSchema.parse({ content: '# Notes', mode: 'append' });
  if (validEdit.mode !== 'append') throw new Error('EditNote schema validation failed');

  // 2. Test SQLite DB Operations
  const db = new DatabaseSync(testDbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaPath = path.resolve('src/lib/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  const pId = 'proj_tools_test';
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    pId,
    'Tools Test Project',
    now,
    now
  );

  // Test create_task
  const taskId = 'task_tool_1';
  db.prepare('INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    taskId,
    pId,
    'Build auth layer',
    'todo',
    'high',
    'Backend',
    0
  );

  let task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task || task.title !== 'Build auth layer') throw new Error('Task creation verification failed');

  // Test toggle_task
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', taskId);
  task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (task.status !== 'done') throw new Error('Toggle task to done failed');

  // Test update_task
  db.prepare('UPDATE tasks SET title = ?, priority = ? WHERE id = ?').run('Build auth layer with JWT', 'low', taskId);
  task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (task.title !== 'Build auth layer with JWT' || task.priority !== 'low') {
    throw new Error('Update task title and priority failed');
  }

  // Test delete_task
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (task) throw new Error('Delete task failed');

  // Test edit_note (replace and append)
  const noteId = 'note_tool_1';
  db.prepare('INSERT INTO notes (id, project_id, title, content) VALUES (?, ?, ?, ?)').run(
    noteId,
    pId,
    'Project Notes',
    'Initial note content.'
  );

  let note = db.prepare('SELECT * FROM notes WHERE project_id = ?').get(pId);
  if (!note || note.content !== 'Initial note content.') throw new Error('Initial note creation failed');

  // Replace
  db.prepare('UPDATE notes SET content = ? WHERE id = ?').run('Replaced note content.', noteId);
  note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (note.content !== 'Replaced note content.') throw new Error('Replace note failed');

  // Append
  const appended = `${note.content}\n\nAppended second section.`;
  db.prepare('UPDATE notes SET content = ? WHERE id = ?').run(appended, noteId);
  note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (!note.content.includes('Appended second section.')) throw new Error('Append note failed');

  // 3. Test Non-Existent taskId handling & Title-Fallback Lookup
  const nonExistentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task_does_not_exist');
  if (nonExistentTask) throw new Error('Expected non-existent task lookup to return null');

  // Insert task for title fallback testing
  const fallbackTaskId = 'task_fallback_1';
  db.prepare('INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    fallbackTaskId,
    pId,
    'Configure OAuth Provider',
    'todo',
    'high',
    'Auth',
    1
  );

  // Exact case-insensitive match
  const exactByTitle = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND LOWER(title) = LOWER(?) LIMIT 1').get(pId, 'configure oauth provider');
  if (!exactByTitle || exactByTitle.id !== fallbackTaskId) {
    throw new Error('Case-insensitive title lookup failed');
  }

  // Partial substring match
  const partialByTitle = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND LOWER(title) LIKE LOWER(?) LIMIT 1').get(pId, '%OAuth%');
  if (!partialByTitle || partialByTitle.id !== fallbackTaskId) {
    throw new Error('Substring title lookup failed');
  }

  // 4. Test ToolCallRecordSchema validation
  const ToolCallRecordSchema = z.object({
    id: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    args: z.record(z.unknown()).optional(),
    data: z.unknown().optional(),
    error: z.string().optional(),
  });
  const ToolCallListSchema = z.array(ToolCallRecordSchema);

  const validToolCalls = [
    { id: 'c1', name: 'create_task', summary: 'Added task', args: { title: 'Test' } },
    { id: 'c2', name: 'toggle_task', summary: 'Completed task', args: { taskId: 't1', isCompleted: true } },
  ];
  const validated = ToolCallListSchema.safeParse(validToolCalls);
  if (!validated.success) throw new Error('Valid tool calls schema parse failed');

  const invalidToolCalls = [{ id: 123, name: null }];
  const invalidResult = ToolCallListSchema.safeParse(invalidToolCalls);
  if (invalidResult.success) throw new Error('Invalid tool calls should be rejected');

  console.log('✅ AI Tool schemas and database mutations verification PASSED successfully!');
} catch (err) {
  console.error('❌ Tools test failed:', err);
  process.exit(1);
} finally {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  } catch {}
}
