import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const testDbDir = path.resolve('data');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

const testDbPath = path.resolve('data/test-snapshots.db');
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

  const pId = 'proj_snap_test';
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    pId,
    'Snapshots Test Project',
    now,
    now
  );

  // 1. Seed initial project state (2 tasks + 1 note)
  db.prepare(
    'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('t1', pId, 'Task One', 'todo', 'high', 'General', 0, now, now);

  db.prepare(
    'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('t2', pId, 'Task Two', 'todo', 'medium', 'General', 1, now, now);

  db.prepare(
    'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run('n1', pId, 'Original Notes', '# Original Note Content', now);

  // 2. Capture Pre-Mutation Snapshot
  const initialTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC').all(pId);
  const initialNote = db.prepare('SELECT * FROM notes WHERE project_id = ?').get(pId);

  const snapshotId = 'snap_test_1';
  const payload = JSON.stringify({ tasks: initialTasks, note: initialNote });
  db.prepare(
    'INSERT INTO undo_snapshots (id, project_id, message_id, snapshot_type, state_payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(snapshotId, pId, 'msg_parent_1', 'all', payload, now);

  // 3. Mutate Project State:
  // - Add task t3
  // - Toggle task t1 to done
  // - Delete task t2
  // - Update note content
  db.prepare(
    'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('t3', pId, 'Task Three (AI Created)', 'todo', 'low', 'General', 2, now, now);

  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', 't1');
  db.prepare('DELETE FROM tasks WHERE id = ?').run('t2');
  db.prepare('UPDATE notes SET content = ? WHERE id = ?').run('# Mutated Note by AI', 'n1');

  // Verify mutated state
  const mutatedTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(pId);
  if (mutatedTasks.length !== 2) throw new Error(`Expected 2 mutated tasks, got ${mutatedTasks.length}`);
  const hasT2 = mutatedTasks.some((t) => t.id === 't2');
  if (hasT2) throw new Error('Task t2 should have been deleted');

  // 4. Perform Atomic Undo / Restoration
  const snap = db.prepare('SELECT * FROM undo_snapshots WHERE id = ?').get(snapshotId);
  if (!snap) throw new Error('Snapshot record not found');

  const { tasks: restoredTasks, note: restoredNote } = JSON.parse(snap.state_payload);

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(pId);
    for (const t of restoredTasks) {
      db.prepare(
        'INSERT INTO tasks (id, project_id, title, status, priority, section, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(t.id, pId, t.title, t.status, t.priority, t.section, t.sort_order, t.created_at, t.updated_at);
    }

    db.prepare('UPDATE notes SET content = ?, title = ? WHERE project_id = ?').run(
      restoredNote.content,
      restoredNote.title,
      pId
    );

    db.prepare('DELETE FROM undo_snapshots WHERE id = ?').run(snapshotId);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // 5. Verify Restored State
  const finalTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC').all(pId);
  if (finalTasks.length !== 2) throw new Error(`Expected 2 tasks after undo, got ${finalTasks.length}`);
  if (finalTasks[0].id !== 't1' || finalTasks[0].status !== 'todo') throw new Error('Task t1 should be reverted to todo');
  if (finalTasks[1].id !== 't2') throw new Error('Task t2 should have been restored');
  const hasT3 = finalTasks.some((t) => t.id === 't3');
  if (hasT3) throw new Error('AI-created task t3 should have been removed by undo');

  const finalNote = db.prepare('SELECT * FROM notes WHERE project_id = ?').get(pId);
  if (finalNote.content !== '# Original Note Content') throw new Error('Note content should be reverted to original');

  // Verify snapshot was consumed
  const consumedSnap = db.prepare('SELECT * FROM undo_snapshots WHERE id = ?').get(snapshotId);
  if (consumedSnap) throw new Error('Snapshot should have been deleted after undo');

  console.log('✅ Undo Snapshot atomic creation and rollback tests PASSED successfully!');
} catch (err) {
  console.error('❌ Snapshot test failed:', err);
  process.exit(1);
} finally {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  } catch {}
}

