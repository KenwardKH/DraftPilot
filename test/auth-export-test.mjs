import crypto from 'node:crypto';
import { z } from 'zod';

// 1. Test Auth Logic
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function verifyPasscode(candidate, expected) {
  if (!expected || expected.trim().length === 0) return true;
  if (!candidate) return false;
  const candidateBuf = Buffer.from(candidate.trim());
  const expectedBuf = Buffer.from(expected.trim());
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

function verifyToken(token, expectedPasscode) {
  if (!expectedPasscode || expectedPasscode.trim().length === 0) return true;
  if (!token) return false;
  const expectedToken = sha256Hex(expectedPasscode.trim());
  const tokenBuf = Buffer.from(token.trim());
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

function timingSafeEqualString(a, b) {
  if (!a || !b) return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;

  let mismatch = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}

// 2. Test Context Brief Exporter Logic
function generateContextBrief(project, note, tasks) {
  const totalCount = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const todoTasks = tasks.filter((t) => t.status !== 'done');
  const doneCount = doneTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const notesContent = note?.content?.trim() || '*(No notes drafted yet)*';

  const todoList = todoTasks.length > 0
    ? todoTasks.map((t) => `- [ ] (${t.priority}) ${t.title}${t.section && t.section !== 'General' ? ` [${t.section}]` : ''}`).join('\n')
    : '*(No pending tasks)*';

  const doneList = doneTasks.length > 0
    ? doneTasks.map((t) => `- [x] (${t.priority}) ${t.title}${t.section && t.section !== 'General' ? ` [${t.section}]` : ''}`).join('\n')
    : '*(No completed tasks)*';

  return `# Project: ${project.name}
> ${project.description || 'No description provided.'}

*Generated: ${new Date().toISOString()} | Interactive AI Project Workspace*

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

try {
  // Test 1: Unset Passcode
  if (!verifyPasscode('any', '')) throw new Error('Unset passcode should allow any input');
  if (!verifyToken('any', '')) throw new Error('Unset passcode should allow any token');

  // Test 2: Set Passcode
  const secret = 'tunnel_secret_987';
  if (verifyPasscode('wrong_password', secret)) throw new Error('Wrong password should be rejected');
  if (!verifyPasscode('tunnel_secret_987', secret)) throw new Error('Correct password should be accepted');

  const validToken = sha256Hex(secret);
  if (verifyToken('invalid_token', secret)) throw new Error('Invalid token should be rejected');
  if (!verifyToken(validToken, secret)) throw new Error('Valid token should be accepted');

  // Test constant-time string comparison helper
  if (!timingSafeEqualString('secret_abc_123', 'secret_abc_123')) {
    throw new Error('timingSafeEqualString failed for identical strings');
  }
  if (timingSafeEqualString('secret_abc_123', 'secret_abc_124')) {
    throw new Error('timingSafeEqualString failed to reject differing character');
  }
  if (timingSafeEqualString('secret_abc_123', 'secret_abc_12')) {
    throw new Error('timingSafeEqualString failed to reject differing length');
  }

  // Test 3: Zod Passcode Schema
  const PasscodeRequestSchema = z.object({
    passcode: z.string().min(1, 'Passcode is required'),
  });

  const parsedValid = PasscodeRequestSchema.parse({ passcode: 'test1234' });
  if (parsedValid.passcode !== 'test1234') throw new Error('Valid passcode schema parse failed');

  let invalidFailed = false;
  try {
    PasscodeRequestSchema.parse({ passcode: '' });
  } catch {
    invalidFailed = true;
  }
  if (!invalidFailed) throw new Error('Empty passcode should fail schema validation');

  // Test 4: Context Brief Exporter
  const mockProject = {
    id: 'p_test',
    name: 'Authentication Subsystem',
    description: 'OAuth and JWT login pipeline',
  };

  const mockNote = {
    content: '## Architecture\nUse Next.js API routes with HTTP-only cookies.',
  };

  const mockTasks = [
    { id: 't1', title: 'Setup DB table', status: 'done', priority: 'high', section: 'Database' },
    { id: 't2', title: 'Implement JWT signing', status: 'todo', priority: 'high', section: 'Auth' },
    { id: 't3', title: 'Write tests', status: 'todo', priority: 'medium', section: 'Testing' },
  ];

  const brief = generateContextBrief(mockProject, mockNote, mockTasks);

  if (!brief.includes('# Project: Authentication Subsystem')) {
    throw new Error('Brief missing project title');
  }
  if (!brief.includes('OAuth and JWT login pipeline')) {
    throw new Error('Brief missing project description');
  }
  if (!brief.includes('Use Next.js API routes with HTTP-only cookies.')) {
    throw new Error('Brief missing note content');
  }
  if (!brief.includes('Progress:** 1/3 tasks completed (33%)')) {
    throw new Error('Brief missing progress percentage');
  }
  if (!brief.includes('- [x] (high) Setup DB table [Database]')) {
    throw new Error('Brief missing completed task');
  }
  if (!brief.includes('- [ ] (high) Implement JWT signing [Auth]')) {
    throw new Error('Brief missing pending task');
  }

  console.log('✅ Passcode verification and Context Exporter tests PASSED successfully!');
} catch (err) {
  console.error('❌ Auth & Exporter test failed:', err);
  process.exit(1);
}

