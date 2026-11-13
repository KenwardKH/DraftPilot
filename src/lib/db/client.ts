import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: DatabaseSync | null = null;

export function getDatabasePath(): string {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'workspace.db');
}

export function initDatabase(dbPath?: string): DatabaseSync {
  const targetPath = dbPath || getDatabasePath();
  const db = new DatabaseSync(targetPath);

  // Configure high-performance, concurrent WAL mode
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // Read and execute schema
  const schemaPath = path.resolve(process.cwd(), 'src/lib/db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  // Ensure a default project exists if the database is newly created
  seedDefaultProject(db);

  return db;
}

function seedDefaultProject(db: DatabaseSync): void {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM projects');
  const result = checkStmt.get() as { count: number | bigint };
  const count = Number(result.count);

  if (count === 0) {
    const defaultProjectId = 'proj_default';
    const now = new Date().toISOString();

    const insertProject = db.prepare(
      'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertProject.run(
      defaultProjectId,
      'My First Project',
      'Default workspace project for brainstorming and planning.',
      now,
      now
    );

    const insertNote = db.prepare(
      'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertNote.run(
      'note_default',
      defaultProjectId,
      'Project Overview',
      '# Welcome to Interactive AI Project Workspace\n\nThis is your live scratchpad. The AI assistant can read and edit this note in real time.',
      now
    );

    const insertTask = db.prepare(
      'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertTask.run(
      'task_default_1',
      defaultProjectId,
      'Explore the split-pane workspace',
      'todo',
      'medium',
      'Getting Started',
      0,
      now,
      now
    );
  }
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

