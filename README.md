# DraftPilot — Interactive AI Project Workspace

> **Local-First, Interactive AI Engineering Co-Pilot & Workspace** pairing a conversational AI assistant with live, bidirectional project artifacts (Markdown notes and task checklists) in real time.

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL_Mode-003b57?style=flat&logo=sqlite)](https://nodejs.org/api/sqlite.html)
[![Node.js](https://img.shields.io/badge/Node.js-22.5+-339933?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview & Key Features

When developers brainstorm architecture, plan features, or troubleshoot code using conversational AI, critical decisions and actionable tasks often get buried inside lengthy chat threads. **DraftPilot** eliminates this friction by integrating a streaming AI chat with a live, persistent project workspace.

As you chat, the AI dynamically updates structured **Project Notes** and a **Task Checklist** via native function calling, while giving you complete control with 1-click Undo rollbacks, full-context exports, and responsive mobile access.

```
+-----------------------------------------------------------------------------------+
|  DraftPilot Split-Pane Architecture                                               |
+-----------------------------------------------------------------------------------+
|  [Left: Conversational AI]                 |  [Right: Live Artifacts]             |
|                                            |                                      |
|  * Streaming SSE token response            |  * Tab 1: Project Notes (Markdown)   |
|  * Automated active context injection      |    - Real-time auto-saving           |
|  * Granular tool calls:                    |    - Split edit & sanitized preview  |
|    - edit_note (replace / append)          |                                      |
|    - create_task, toggle_task,             |  * Tab 2: Task Checklist             |
|      update_task, delete_task              |    - Todo / In Progress / Done       |
|  * 1-Click Atomic Undo Rollback Card       |    - Priority tags & "NEW" badges    |
+-----------------------------------------------------------------------------------+
|  Local SQLite WAL Persistence (data/workspace.db) • 9Router Gateway / BYOK        |
+-----------------------------------------------------------------------------------+
```

### Core Capabilities

- **Discuss-First, Decide-to-Notes, Pending-to-Checklist Workflow:**
  - **Discuss First:** Open-ended brainstorming, architecture comparisons, and trade-offs remain in chat without premature workspace mutations.
  - **Decide to Notes:** Once a design choice is confirmed, the AI drafts clean documentation directly into **Project Notes** using `edit_note`.
  - **Pending to Checklist:** Unresolved items and follow-ups are automatically registered as actionable checklist tasks using `create_task` (e.g., `"Decide: Auth strategy"`).
  - **Human-Readable Mutation Summaries:** After executing tools, the assistant lists exact bullet points of what was added, changed, or removed.
  - **Visual Diffing & `NEW` Badges:** Newly created checklist items feature a prominent `NEW` badge and visual pulse animation.

- **1-Click Atomic Undo Snapshots:**
  - Before any tool batch executes, an atomic SQLite transaction captures an exact snapshot of notes and tasks into `undo_snapshots`.
  - Chat status cards display an **"Undo Changes"** button, allowing instant, 1-click rollback of any automated edit.

- **Concurrent External Tool Access via SQLite WAL:**
  - Built on Node.js native `node:sqlite` configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`).
  - External CLI agents (e.g., OpenCode, Claude Code, Cursor) or custom shell scripts can read and write `data/workspace.db` concurrently without encountering file lock collisions or database corruption.

- **Hybrid AI Gateway Connection:**
  - **Host Default:** Connects out-of-the-box to a local `9Router` proxy (`http://localhost:20128/v1`) using server environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) for zero-friction local development and free-tier dogfooding.
  - **Client BYOK (Bring Your Own Key):** Users can open the in-app **Settings** modal to input custom endpoints (OpenRouter, Google Gemini, OpenAI, Ollama) and API keys. BYOK credentials are stored strictly in client `localStorage` and never logged or persisted on the server.

- **Mobile-Responsive UI & Drawer:**
  - **Desktop (≥ 768px):** Side-by-side split-pane view with persistent project sidebar.
  - **Mobile (< 768px):** Clean slide-over project drawer and a sticky 3-tab workspace switcher (**Chat** | **Notes** | **Checklist**) with live task counters and mutation indicator dots.
  - Uses `h-[100dvh]` container styling to keep the chat input pinned and visible above mobile virtual keyboards.

- **Context & Specification Exporter:**
  - One-click **Export Context** modal generates a consolidated, publication-ready Markdown brief including project metadata, notes, and checklist items.
  - Features real-time Markdown preview (sanitized with `rehype-sanitize`), one-click clipboard copy, and `.md` file download.

- **Optional Zero-Trust Passcode Gate (`WORKSPACE_PASSCODE`):**
  - Protects all `/api/*` endpoints with timing-safe constant-time passcode verification when sharing local instances over public tunnels (Cloudflare Tunnel, Ngrok).
  - Zero login friction when left unset.

---

## 📋 Prerequisites

- **Node.js:** `v22.5.0` or higher (required for built-in `node:sqlite`).
- **Package Manager:** `npm` (bundled with Node.js) or `pnpm` / `yarn`.
- **AI Backend (Choose one):**
  - **Local 9Router (Recommended for local/free models):** Running locally at `http://localhost:20128/v1`.
  - **Any OpenAI-Compatible Provider:** [OpenRouter](https://openrouter.ai/), OpenAI, Google Gemini API, Ollama, etc.

---

## 🚀 Clone & Setup Instructions

Follow these step-by-step instructions to get DraftPilot running locally:

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/interactive-ai-project-workspace.git
cd interactive-ai-project-workspace
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the provided `.env.example` template to `.env.local`:

```bash
cp .env.example .env.local
```

Inspect the variables in `.env.local`:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `AI_BASE_URL` | `http://localhost:20128/v1` | URL of the OpenAI-compatible AI proxy or provider. |
| `AI_API_KEY` | `sk-9router` | API key for the AI gateway (or provider secret). |
| `AI_MODEL` | `gemini-2.5-flash` | Default LLM model identifier for chat and tool calling. |
| `WORKSPACE_PASSCODE` | `""` *(empty)* | Optional passcode to lock API routes when sharing via tunnels. |
| `PORT` | `3000` | Local HTTP server port for Next.js. |

> **Note:** The SQLite database (`data/workspace.db`) is initialized and migrated automatically on first application launch. No external database server (PostgreSQL, MySQL, Redis) is required.

---

## 🛠️ How to Run & Use

### Option A — Using Local 9Router Gateway (Default)

1. Ensure **9Router** is running locally:
   ```bash
   9router start
   # Verify that http://localhost:20128/v1 is listening
   ```

2. Start the DraftPilot development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
4. Click the **Settings** icon in the top header and click **"Test Connection"** to verify that the host 9Router gateway is reachable.

---

### Option B — Using Bring Your Own Key (BYOK)

If you do not run 9Router locally, you can connect directly to OpenRouter, OpenAI, or Gemini:

1. Start the server with `npm run dev` and open [http://localhost:3000](http://localhost:3000).
2. Click the **Settings** (gear) icon in the top navigation bar.
3. Under **Client BYOK (Overrides Host)**, fill in your details:
   - **Base URL:** e.g., `https://openrouter.ai/api/v1` or `https://api.openai.com/v1`
   - **API Key:** `sk-or-v1-...` (or your provider key)
   - **Model Name:** e.g., `google/gemini-2.5-flash`, `gpt-4o-mini`, or `anthropic/claude-3.5-sonnet`
4. Click **"Test Connection"**, then click **"Save Settings"**.
5. Your BYOK credentials are stored strictly in your browser's `localStorage` and sent over HTTPS via client headers (`x-ai-base-url`, `x-ai-api-key`, `x-ai-model`).

---

### Option C — Sharing Safely via Cloudflare Tunnel (`cloudflared`)

To collaborate with a remote colleague or test on a mobile device over the internet:

1. Configure a secure passcode in `.env.local`:
   ```bash
   WORKSPACE_PASSCODE="your-secure-passcode-here"
   ```

2. Start the local server:
   ```bash
   npm run dev
   ```

3. Launch a Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

4. Share the generated public tunnel URL (e.g., `https://random-words.trycloudflare.com`).
5. Visitors will be greeted by the **Passcode Gate** and must enter the passcode once. Upon verification, a session cookie is issued and all `/api/*` endpoints unlock securely.

---

## 📁 Project Structure & Documentation

```text
interactive-ai-project-workspace/
├── data/                            # Local SQLite storage (gitignored)
│   └── workspace.db                 # Auto-initialized SQLite database in WAL mode
├── docs/                            # Engineering specifications & blueprints
│   ├── PRD.md                       # Product Requirements Document
│   ├── ARCHITECTURE.md              # Technical Architecture & Interface Contracts
│   └── TASKS.md                     # Tracer-bullet implementation backlog
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # Backend API Routes
│   │   │   ├── ai/                  # AI config & health test endpoints
│   │   │   ├── auth/                # Passcode status, verify, and logout
│   │   │   ├── chat/                # SSE streaming & tool calling engine
│   │   │   ├── notes/               # Project Notes CRUD
│   │   │   ├── projects/            # Project workspace management
│   │   │   ├── tasks/               # Task checklist CRUD & reordering
│   │   │   └── undo/                # Atomic snapshot reversal endpoint
│   │   ├── layout.tsx               # Root application layout
│   │   ├── page.tsx                 # Main responsive workspace & tab switcher
│   │   └── globals.css              # Tailwind styles & animations
│   ├── components/                  # React UI Components
│   │   ├── artifacts/               # Markdown editor, preview & task checklist
│   │   ├── chat/                    # Chat pane, message list & tool cards
│   │   ├── modals/                  # Export, Settings (BYOK), Passcode modals
│   │   └── sidebar/                 # Project navigation sidebar & mobile drawer
│   ├── lib/                         # Business Logic & Infrastructure
│   │   ├── ai/                      # System context injection, tools & BYOK resolver
│   │   ├── auth/                    # Passcode validation & constant-time comparison
│   │   ├── db/                      # SQLite client, schema, and queries
│   │   ├── export/                  # Consolidated Markdown brief generator
│   │   └── types/                   # TypeScript interfaces & Zod schemas
│   └── middleware.ts                # Edge security middleware for passcode gate
├── test/                            # Automated test suite (pure Node.js)
│   ├── ai-provider-test.mjs         # BYOK & host resolver tests
│   ├── artifacts-test.mjs           # Notes & tasks CRUD tests
│   ├── auth-export-test.mjs         # Passcode verification & Markdown exporter tests
│   ├── chat-test.mjs                # SSE context injection tests
│   ├── db-test.mjs                  # SQLite WAL & schema verification
│   ├── projects-test.mjs            # Project lifecycle & cascade deletion tests
│   ├── snapshots-test.mjs           # Undo snapshot atomicity & rollback tests
│   └── tools-test.mjs               # AI tool calling validation & execution tests
├── .env.example                     # Environment template
├── AGENTS.md                        # Guidelines for AI agents (Antigravity, OpenCode)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

For detailed specifications, see:
- [Product Requirements Document (`docs/PRD.md`)](docs/PRD.md)
- [Architecture Blueprint (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [Implementation Backlog (`docs/TASKS.md`)](docs/TASKS.md)
- [Agent Operating Instructions (`AGENTS.md`)](AGENTS.md)

---

## 🧪 Testing & Verification

DraftPilot includes an automated test suite covering database operations, AI provider resolution, chat context injection, tool calling execution, undo rollbacks, and security gates.

```bash
# Run the complete test suite
npm test

# Run TypeScript type verification
npx tsc --noEmit

# Test production compilation & asset bundling
npm run build
```

---

## 🛡️ Security & Privacy Highlights

1. **Zero-Log Secrets:** API keys and passcodes are never written to disk, SQLite tables, or server stdout.
2. **Constant-Time Passcode Check:** Authentication compares tokens using Web Crypto constant-time byte comparisons to resist timing side-channel attacks.
3. **Strict XSS Sanitization:** All user-supplied and AI-generated Markdown rendered in the UI or downloaded via the Exporter passes through `react-markdown` + `remark-gfm` + `rehype-sanitize`.
4. **Parameterized SQL Queries:** Every database mutation uses parameterized SQLite statements to prevent SQL injection.
5. **Project Data Isolation:** All tasks, notes, messages, and undo snapshots are strictly partitioned by `project_id` with cascading deletions.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`).
2. Adhere to the established code conventions in [`AGENTS.md`](AGENTS.md).
3. Ensure all tests and type checks pass:
   ```bash
   npm test && npx tsc --noEmit
   ```
4. Commit your changes and open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
