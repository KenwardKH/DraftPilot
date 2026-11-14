import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const testDbDir = path.resolve('data');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

const testDbPath = path.resolve('data/test-chat.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

function formatProjectContext(notesContent, tasks) {
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

try {
  const db = new DatabaseSync(testDbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaPath = path.resolve('src/lib/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  const pId = 'proj_chat_test';
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    pId,
    'Chat Test Project',
    now,
    now
  );

  // 1. Test Message Insertion
  const msgUser = {
    id: 'msg_u1',
    project_id: pId,
    role: 'user',
    content: 'Hello, what should we build?',
    tool_calls: null,
    tool_call_id: null,
    created_at: new Date(Date.now() - 1000).toISOString(),
  };

  const msgAssistant = {
    id: 'msg_a1',
    project_id: pId,
    role: 'assistant',
    content: 'We should build a local-first workspace.',
    tool_calls: null,
    tool_call_id: null,
    created_at: new Date().toISOString(),
  };

  const insertStmt = db.prepare(
    'INSERT INTO messages (id, project_id, role, content, tool_calls, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertStmt.run(msgUser.id, msgUser.project_id, msgUser.role, msgUser.content, msgUser.tool_calls, msgUser.tool_call_id, msgUser.created_at);
  insertStmt.run(msgAssistant.id, msgAssistant.project_id, msgAssistant.role, msgAssistant.content, msgAssistant.tool_calls, msgAssistant.tool_call_id, msgAssistant.created_at);

  const queryStmt = db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC');
  const messages = queryStmt.all(pId);

  if (messages.length !== 2) {
    throw new Error(`Expected 2 messages, got ${messages.length}`);
  }
  if (messages[0].role !== 'user' || messages[1].role !== 'assistant') {
    throw new Error('Message roles do not match expected order');
  }

  // 2. Test Invalid Role Constraint
  let constraintPassed = false;
  try {
    insertStmt.run('msg_bad', pId, 'invalid_role', 'Test', null, null, now);
  } catch {
    constraintPassed = true;
  }
  if (!constraintPassed) {
    throw new Error('CHECK constraint for message role failed to block invalid role');
  }

  // 3. Test Clearing Messages
  db.prepare('DELETE FROM messages WHERE project_id = ?').run(pId);
  const cleared = queryStmt.all(pId);
  if (cleared.length !== 0) {
    throw new Error(`Expected 0 messages after clear, got ${cleared.length}`);
  }

  // 4. Test Cascade Deletion on Project Delete
  insertStmt.run('msg_u2', pId, 'user', 'Will be cascaded', null, null, now);
  db.prepare('DELETE FROM projects WHERE id = ?').run(pId);
  const afterProjDelete = queryStmt.all(pId);
  if (afterProjDelete.length !== 0) {
    throw new Error('Project cascade deletion failed to remove associated messages');
  }

  // 5. Test Context Builder formatting
  const emptyContext = formatProjectContext('', []);
  if (!emptyContext.includes('(No notes drafted yet)') || !emptyContext.includes('(No tasks in checklist yet)')) {
    throw new Error('Empty context formatting failed');
  }

  const populatedContext = formatProjectContext('# Architecture Plan\nUse SQLite with WAL.', [
    { id: 't1', title: 'Initialize Git', status: 'done', priority: 'high', section: 'Core' },
    { id: 't2', title: 'Implement SSE Chat', status: 'in_progress', priority: 'high', section: 'Chat' },
    { id: 't3', title: 'Review Code', status: 'todo', priority: 'medium', section: 'General' },
  ]);

  if (!populatedContext.includes('# Architecture Plan')) {
    throw new Error('Populated context missing notes content');
  }
  if (!populatedContext.includes('- [ID: t1] [x] (high) Initialize Git [Section: Core]')) {
    throw new Error('Populated context missing task 1');
  }
  if (!populatedContext.includes('- [ID: t2] [/] (high) Implement SSE Chat [Section: Chat]')) {
    throw new Error('Populated context missing task 2');
  }
  if (!populatedContext.includes('- [ID: t3] [ ] (medium) Review Code')) {
    throw new Error('Populated context missing task 3');
  }

  console.log('✅ Chat persistence and context injection tests passed successfully!');
} catch (err) {
  console.error('❌ Chat test failed:', err);
  process.exit(1);
} finally {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  } catch {}
}
