# Product Requirements Document (PRD)

## Project: Interactive AI Project Workspace
- **Author:** Principal Software Architect & Product Lead
- **Status:** Approved / Ready for Architecture & Task Breakdown
- **Target Release:** v1.0.0 MVP

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
When developers brainstorm software architecture, plan features, or troubleshoot code using conversational AI interfaces, critical decisions, actionable tasks, and notes get lost inside long conversation threads. Users are forced to manually copy and paste text into external note-taking or issue-tracking tools. Furthermore, as conversations grow, the AI loses awareness of the active project state, resulting in hallucinations or conflicting instructions.

### 1.2 The Solution
The **Interactive AI Project Workspace** provides a unified, project-scoped workspace where a conversational AI assistant actively maintains structured project artifacts (Markdown notes and task checklists) in real time via native tool calling. Operating locally with SQLite persistence and a hybrid BYOK / Host-default AI gateway, the workspace gives developers instant, live control over their projects with zero server costs and zero vendor lock-in.

---

## 2. Target Personas

1. **The Solo Developer (Host / Dogfooder):**
   - Works on Windows 11 with 8 GB RAM.
   - Runs local `9router` with Gemini / free tier models.
   - Demands low memory overhead, instant UI responsiveness, and automatic artifact updates without manual copy-pasting.

2. **The Collaborative Tester (Tunnel Guest):**
   - Receives a temporary tunnel link (e.g., Cloudflare Tunnel) from the host.
   - Wants zero-friction access: immediately starts testing and chatting without setting up API keys or signing up for accounts.
   - Enters an optional workspace passcode once if configured by the host.

3. **The Open-Source Developer (Self-Hoster):**
   - Clones the repository from GitHub.
   - Either sets up `.env.local` with their preferred provider or opens the Settings modal in the browser to input their own OpenAI-compatible endpoint, API key, and model.

---

## 3. Core Functional Requirements (MVP Scope)

### FR-1: Workspace & Project Isolation
- Users can create, rename, switch between, and delete projects.
- Each project maintains its own isolated:
  - Chat history (user messages, assistant messages, tool call executions).
  - Structured Markdown notes (live editor and preview).
  - Checklist tasks (with status: `todo`, `in_progress`, `done`, priority, and ordering).
- Data persists across browser refreshes and server restarts in `data/workspace.db`.

### FR-2: Hybrid AI Gateway & BYOK Configuration
- **Host Default:** When requests arrive without custom headers, `/api/chat` routes to `AI_BASE_URL` (default `http://localhost:20128/v1`) using `AI_API_KEY` and `AI_MODEL` defined in `.env.local`.
- **Client BYOK Override:** Users can open a "Settings" modal to specify:
  - Base URL (e.g., `https://openrouter.ai/api/v1`, `http://localhost:20128/v1`, `https://generativelanguage.googleapis.com/v1beta/openai/`)
  - API Key
  - Model Name (e.g., `gemini-2.5-flash`, `gpt-4o-mini`, `coding-free`)
- BYOK credentials are saved strictly in the browser's `localStorage` and passed to `/api/chat` via HTTP headers (`x-ai-base-url`, `x-ai-api-key`, `x-ai-model`).
- If neither host `.env.local` nor client BYOK is configured, the UI prompts the user to open Settings.

### FR-3: Conversational AI with Server-Sent Events (SSE) Streaming
- Real-time token streaming with Markdown formatting.
- Auto-scroll to bottom with manual scroll override.
- Clear error handling (displays graceful toasts if the AI endpoint is unreachable or credentials are invalid).

### FR-4: Context-Aware System Injection & Native Tool Calling
- On every chat completion call, the backend automatically injects the current project context into the system prompt:
  - `[ACTIVE NOTES]`: Current project notes content.
  - `[ACTIVE CHECKLIST]`: Formatted list of all tasks with their IDs, titles, priorities, and completion states.
- The AI has access to granular tools:
  - `create_task(title: string, priority?: "low" | "medium" | "high", section?: string)`
  - `toggle_task(taskId: string, isCompleted: boolean)`
  - `update_task(taskId: string, newTitle?: string, priority?: "low" | "medium" | "high")`
  - `delete_task(taskId: string)`
  - `edit_note(noteId: string, content: string, mode: "replace" | "append")`

### FR-5: Live Split-Pane Artifacts & Optimistic UI
- **Split-Screen Layout:**
  - Left Pane: Interactive Chat Interface.
  - Right Pane: Tabbed Artifact Viewer (Tab 1: Markdown Notes, Tab 2: Task Checklist).
- **Optimistic Auto-Apply:** When tool calls execute, the checklist and notes update immediately with a visual highlight pulse.
- **1-Click Undo Snapshot:** Each tool-call execution card in chat retains a snapshot of the prior state with an **Undo** button to revert changes immediately.

### FR-6: Context / Specification Exporter
- One-click "Export Context" button generates a consolidated, clean Markdown document:
  - Project Title & Overview
  - Notes & Architecture Decisions
  - Task Breakdown (completed vs. pending)
- Options to "Copy to Clipboard" or "Download as .md" (ready for `SPEC.md` or other coding agents).

### FR-7: Security & Tunnel Gate (Passcode Protection)
- Optional `WORKSPACE_PASSCODE` in `.env.local`.
- If set, visitors must submit the passcode via a simple modal; valid passcodes are stored in a session cookie or header (`x-workspace-passcode`).
- All API routes (`/api/*`) validate the passcode before performing AI calls or database mutations.
- If unset/empty, access is immediate with zero authentication friction.

---

## 4. Non-Functional Requirements (NFR)

1. **Performance & RAM Constraints:**
   - Designed to run comfortably on Windows 11 with 8 GB RAM alongside Antigravity IDE and 9Router.
   - Initial page load < 1.5 seconds locally.
   - Database read/write queries < 15ms.
2. **Security & Zero-Logging:**
   - API keys and authorization headers are never logged to console or files.
   - Strict XSS sanitization on all rendered Markdown using `rehype-sanitize`.
   - All SQLite queries are fully parameterized to prevent SQL injection.
3. **Data Integrity:**
   - SQLite WAL mode prevents database locks and ensures atomic transactions during concurrent requests.
4. **Browser Compatibility:**
   - Fully compatible with modern Chromium browsers (Chrome, Edge, Brave) and Firefox.

---

## 5. Explicitly Out of Scope for v1 (MVP Boundaries)

- Multi-tenant user registration with individual logins and passwords.
- Cloud database synchronization (Supabase, Firebase, Postgres).
- File/Image/PDF uploads and multimodal processing.
- Vector database embedding pipelines and retrieval-augmented generation (RAG).
- Multi-user real-time WebSockets / CRDT collaboration (single-user / small group tunnel access is sufficient).

