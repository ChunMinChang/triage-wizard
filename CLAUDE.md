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

Frontend (test - optional):
```bash
cd frontend
npm install   # First time only
npm test      # Run Vitest tests
```

Backend (optional):
```bash
cd backend-rust
cargo run
```

## Where to make changes

- Bugzilla fetch/parsing: `frontend/src/bugzilla.js`
- AI provider routing/prompts: `frontend/src/ai.js`
- Tag rules: `frontend/src/tags.js`
- Filters: `frontend/src/filters.js`
- UI table + summary expander: `frontend/src/ui.js`
- Canned responses parser/import: `frontend/src/cannedResponses.js`
- Export formats: `frontend/src/exports.js`

## Claude Code CLI mode (backend)

Backend may be configured to call **Claude Code CLI** instead of Anthropic HTTP API:
- `CLAUDE_BACKEND_MODE=cli`

In this mode the backend spawns:
- `claude -p --output-format json --json-schema '<schema>' --model <model>`

The backend extracts `structured_output` and returns it to the frontend.

## What to avoid

- Do not auto-post AI outputs to Bugzilla; always require explicit user action.
- Do not store secrets in exports.
- Avoid large dependencies for parsing; keep it lightweight.

