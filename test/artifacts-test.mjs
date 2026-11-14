import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const testDbDir = path.resolve('data');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

const testDbPath = path.resolve('data/test-artifacts.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

try {
  const db = new DatabaseSync(testDbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaPath = path.resolve('src/lib/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  const pId = 'proj_art_test';
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    pId,
    'Artifacts Test Project',
    now,
    now
  );

  // 1. Test Note Creation & Update
  const noteId = 'note_1';
  db.prepare('INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    noteId,
    pId,
    'Initial Title',
    '# Initial Content',
    now
  );

  const note = db.prepare('SELECT * FROM notes WHERE project_id = ?').get(pId);
  if (!note || note.content !== '# Initial Content') {
    throw new Error('Note creation failed');
  }

  // Update note
  const updatedNoteContent = '# Updated Markdown Content';
  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(updatedNoteContent, now, noteId);
  const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (updatedNote.content !== updatedNoteContent) {
    throw new Error('Note update failed');
  }

  // 2. Test Task Creation & Ordering
  db.prepare('INSERT INTO tasks (id, project_id, title, status, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
    't_1',
    pId,
    'First Task',
    'todo',
    'high',
    0
  );

  db.prepare('INSERT INTO tasks (id, project_id, title, status, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
    't_2',
    pId,
    'Second Task',
    'todo',
    'low',
    1
  );

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC').all(pId);
  if (tasks.length !== 2 || tasks[0].id !== 't_1' || tasks[1].id !== 't_2') {
    throw new Error('Task sorting order verification failed');
  }

  // 3. Test Task Status Toggle
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', 't_1');
  const toggledTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get('t_1');
  if (toggledTask.status !== 'done') {
    throw new Error('Task toggle failed');
  }

  // 4. Test Task Deletion
  db.prepare('DELETE FROM tasks WHERE id = ?').run('t_2');
  const remainingTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(pId);
  if (remainingTasks.length !== 1 || remainingTasks[0].id !== 't_1') {
    throw new Error('Task deletion failed');
  }

  db.close();

  // Cleanup test DB
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

  console.log('✅ Artifacts database operations (notes & tasks) PASSED successfully!');
} catch (error) {
  console.error('❌ Artifacts test failed:', error);
  process.exit(1);
}

