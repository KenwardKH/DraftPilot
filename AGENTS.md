# AGENTS.md — Interactive AI Project Workspace

Welcome to the **Interactive AI Project Workspace** repository. This document serves as the single source of truth for AI agents (Antigravity IDE, OpenCode, Claude Code) and human contributors working within this codebase.

---

## 1. Project Vision & Architecture Overview

The **Interactive AI Project Workspace** is an open-source, local-first developer productivity application. It bridges the gap between conversational AI and actionable software engineering by pairing an AI chat interface with a live, bidirectional split-pane containing structured project artifacts (Markdown notes and task checklists).

### Core Capabilities:
- **Local SQLite Persistence:** Single-file storage (`data/workspace.db`) with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) ensuring zero external database dependencies and high concurrent read performance.
- **Hybrid AI Gateway Connection:**
  - **Host Default:** Connects directly to local `9router` (`http://localhost:20128/v1`) using server environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) for zero-friction local dogfooding and tunnel demos.
  - **Client BYOK Override:** Accepts client-provided headers (`x-ai-base-url`, `x-ai-api-key`, `x-ai-model`) stored in the browser's `localStorage` for privacy-first, zero-trust open-source usage.
- **Granular AI Tool Calling:** The AI assistant uses native tool calling to mutate checklists (`create_task`, `toggle_task`, `update_task`, `delete_task`) and notes (`edit_note`) with live optimistic UI updates and 1-click Undo snapshots.
- **Tunnel Security:** Optional `WORKSPACE_PASSCODE` gate protects API routes when sharing temporary tunnel endpoints with collaborators.

---

## 2. Technical Stack

- **Framework:** Next.js (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS + Lucide React Icons
- **Database:** SQLite via Node.js native engine or `better-sqlite3` with WAL mode
- **AI Integration:** AI SDK / OpenAI-compatible SSE streaming with function calling
- **Markdown & Sanitation:** `react-markdown` + `remark-gfm` + `rehype-sanitize` (strict XSS prevention)
- **Validation:** Zod schemas on all API boundaries and tool parameters

---

## 3. Strict Security & Safety Rules

1. **Zero-Log Secrets:** Never log API keys, authorization tokens, or passwords to stdout, console, or files.
2. **Environment Isolation:** `.env.local` and `data/*.db*` must remain strictly in `.gitignore`. A clean `.env.example` must be maintained at all times.
3. **Parameterized SQL:** All database operations must use parameterized queries. Dynamic string interpolation in SQL queries is strictly forbidden.
4. **XSS Protection:** All Markdown rendering on both client and exported briefs must pass through sanitization pipelines. Never bypass `rehype-sanitize`.
5. **Passcode Guarding:** When `WORKSPACE_PASSCODE` is configured, all API endpoints (`/api/*`) must reject unauthenticated requests with HTTP `401 Unauthorized`.

---

## 4. Engineering Workflow Spine

Contributors and coding agents must adhere to the installed Matt Pocock engineering skills:

1. **`/grill-with-docs`**: Challenge requirements and eliminate technical ambiguity before design changes.
2. **`/to-spec`**: Update `docs/PRD.md` and `docs/ARCHITECTURE.md` before implementing large features.
3. **`/to-tickets`**: Update `docs/TASKS.md` with vertically sliced, dependency-tracked tracer tasks.
4. **`/implement`**: Pick one unblocked ticket at a time and follow strict Test-Driven Development (Red -> Green -> Refactor).
5. **`/code-review`**: Review diffs along **Standards** and **Spec Fidelity** before merging.

---

## 5. Development Commands (PowerShell Compatible)

```powershell
# Install dependencies
npm install

# Start local development server
npm run dev

# Run automated tests
npm test

# Run linter & type check
npm run lint; npx tsc --noEmit
```

