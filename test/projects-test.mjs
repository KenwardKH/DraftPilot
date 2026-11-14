import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Set up clean test environment
const testDbDir = path.resolve('data');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

const testDbPath = path.resolve('data/test-projects.db');
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

  // 1. Test Project Creation
  const pId = 'proj_test_1';
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    pId,
    'Alpha Project',
    'Description of Alpha',
    now,
    now
  );

  // Also create a note and task for Alpha to test cascade
  db.prepare('INSERT INTO notes (id, project_id, title, content) VALUES (?, ?, ?, ?)').run(
    'note_alpha',
    pId,
    'Alpha Notes',
    'Content of notes'
  );

  db.prepare('INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)').run(
    'task_alpha',
    pId,
    'Alpha Task 1'
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pId);
  if (!project || project.name !== 'Alpha Project') {
    throw new Error('Project insertion failed');
  }

  // 2. Test Project Update
  const updatedNow = new Date().toISOString();
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run('Alpha Renamed', updatedNow, pId);
  const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(pId);
  if (updatedProject.name !== 'Alpha Renamed') {
    throw new Error('Project update failed');
  }

  // 3. Test Cascade Deletion
  db.prepare('DELETE FROM projects WHERE id = ?').run(pId);
  const deletedProj = db.prepare('SELECT * FROM projects WHERE id = ?').get(pId);
  if (deletedProj) {
    throw new Error('Project was not deleted');
  }

  const orphanedNote = db.prepare('SELECT * FROM notes WHERE project_id = ?').get(pId);
  if (orphanedNote) {
    throw new Error('Cascade delete failed: note was not deleted');
  }

  const orphanedTask = db.prepare('SELECT * FROM tasks WHERE project_id = ?').get(pId);
  if (orphanedTask) {
    throw new Error('Cascade delete failed: task was not deleted');
  }

  db.close();

  // Cleanup test DB
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

  console.log('✅ Project database operations and cascade deletion PASSED successfully!');
} catch (error) {
  console.error('❌ Project test failed:', error);
  process.exit(1);
}
