import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const testDbPath = path.resolve('data/test-workspace.db');

try {
  // Ensure data directory exists
  const dataDir = path.dirname(testDbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Clean up any old test DB
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

  const db = new DatabaseSync(testDbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const journalMode = db.prepare('PRAGMA journal_mode;').get();
  console.log('Journal mode:', journalMode);

  if (journalMode.journal_mode !== 'wal') {
    throw new Error(`Expected journal_mode to be 'wal', got '${journalMode.journal_mode}'`);
  }

  const schemaPath = path.resolve('src/lib/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all();
  console.log('Tables created:', tables.map(t => t.name));

  const expectedTables = ['messages', 'notes', 'projects', 'tasks', 'undo_snapshots'];
  for (const expected of expectedTables) {
    if (!tables.some(t => t.name === expected)) {
      throw new Error(`Missing table: ${expected}`);
    }
  }

  // Insert a test project
  db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)').run('p1', 'Test Project', 'Testing');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get('p1');
  console.log('Inserted project:', project);

  // Insert a test task
  db.prepare('INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)').run('t1', 'p1', 'First task');
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('t1');
  console.log('Inserted task:', task);

  db.close();

  // Cleanup test DB
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

  console.log('✅ SQLite WAL verification PASSED successfully!');
} catch (error) {
  console.error('❌ Verification failed:', error);
  process.exit(1);
}
