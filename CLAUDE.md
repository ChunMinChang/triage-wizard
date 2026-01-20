# Claude Code Instructions (Project)

This repo is designed to work well with **Claude Code** (terminal/IDE coding agent).

## Project summary

A client-first web app to triage Mozilla Bugzilla bugs:
- ingest bug lists
- compute tags (heuristics + optional AI)
- generate brief summaries
- recommend and draft canned responses
- optionally write back `Has STR` and post comments

## Non-negotiables

- Frontend must remain **pure HTML/CSS/JS** (no frameworks).
- **No build step required** - browser loads ES modules directly.
- **npm is for testing only** - `node_modules/` is not needed to run the app.
- Keep module boundaries clean:
  - network in `bugzilla.js` / `ai.js`
  - pure logic in `tags.js` / `filters.js`
  - DOM rendering in `ui.js`
- Preserve tag semantics:
  - `test-attached` is **non-AI only**
  - `AI-detected test-attached` is **AI only**

## Dev commands

Frontend (run):
```bash
cd frontend
python -m http.server 8000
```

Frontend (test):
```bash
cd frontend
npm install   # First time only
npm test      # Run Vitest tests
```

Backend (optional):
```bash
cd backend-rust
CLAUDE_BACKEND_MODE=cli cargo run
```

## Key files

### Frontend Core
- `frontend/src/app.js` - Orchestration, event handlers, bug processing
- `frontend/src/ui.js` - DOM rendering, table, modals, toasts
- `frontend/src/bugzilla.js` - Bugzilla REST API integration
- `frontend/src/ai.js` - AI provider abstraction (Gemini, Claude)
- `frontend/src/prompts.js` - **All AI prompts and schemas centralized here**
- `frontend/src/tags.js` - Tag computation logic
- `frontend/src/filters.js` - Bug filtering logic

### Frontend Support
- `frontend/src/config.js` - Settings management
- `frontend/src/storage.js` - localStorage wrapper
- `frontend/src/cannedResponses.js` - Canned response library
- `frontend/src/exports.js` - JSON/CSV/Markdown export
- `frontend/src/aiLogger.js` - AI interaction logging

### Backend
- `backend-rust/src/main.rs` - Axum server, routes, handlers
- `backend-rust/src/claude_cli.rs` - Claude Code CLI integration

## AI prompts architecture

**All AI prompts are centralized in `frontend/src/prompts.js`**:
- Schemas for structured output (classify, suggest, generate, refine, testpage)
- Prompt builders for each AI task
- Shared between browser mode and backend mode

When backend is used, frontend sends the pre-built prompt and schema to backend.
Backend just passes them to Claude CLI - no prompt logic in backend.

## Claude Code CLI mode (backend)

Backend can use **Claude Code CLI** instead of HTTP API:
- Set `CLAUDE_BACKEND_MODE=cli`
- Backend spawns: `claude -p --output-format json --json-schema '<schema>' --model <model>`
- Backend extracts `structured_output` and returns to frontend
- Requires Claude Code installed and authenticated (`claude login`)

## Current features

- Bug loading: IDs, REST URLs, buglist.cgi URLs
- Heuristic tagging: Has STR, test-attached, crashstack, fuzzy-test-attached
- AI tagging: AI-detected STR, AI-detected test-attached
- AI summaries with expandable rows
- AI triage suggestions (severity, priority, actions)
- Canned response library with AI customization
- Multi-select refinement options (Shorter, Friendlier, +STR)
- Auto test page generation from code snippets
- Export to JSON/CSV/Markdown
- AI interaction logging

## What to avoid

- Do not auto-post AI outputs to Bugzilla; always require explicit user action.
- Do not store secrets in exports.
- Do not add backend prompt logic - keep prompts in `frontend/src/prompts.js`.
- Avoid large dependencies; keep it lightweight.
