# Bugzilla Bug Triage Helper (POC)

A client-first web app to ingest Mozilla Bugzilla bugs, analyze them (heuristics + optional AI), apply triage tags, generate brief summaries, and recommend/craft canned responses to request additional info from reporters.

This repo is designed to be:
- **Framework-free** (pure HTML/CSS/JS)
- **Claude Code friendly** (clear module boundaries, CLAUDE.md guidance)
- **AI-provider flexible** (Gemini + Claude prioritized; OpenAI supported)
- **Low-friction** for Mozilla engineers triaging small bug sets (≤ 20 bugs typical)

---

## Goals

### Primary
- Load a bug list (IDs, REST query, or `buglist.cgi` URL), fetch bug data via Bugzilla REST, and display bugs in a table.
- Apply tags to each bug using:
  - Bugzilla metadata
  - Attachment analysis
  - Text heuristics
  - Optional AI classification
- Provide **filters** (tags and tag-difference) to surface actionable “low hanging fruit” bugs.

### Secondary
- Provide a **brief AI summary** per bug (expandable inline).
- Provide **canned response tooling**:
  - Select a canned response and optionally AI-customize it.
  - Or let AI suggest a best canned response and generate a draft reply.

---

## What this tool detects (tags)

Required tags:
1. **Has STR** — based on Bugzilla field `cf_has_str`.
2. **test-attached** — based on Bugzilla keywords/flags and attachments (non-AI only).
3. **fuzzy-test-attached** — fuzzing testcase signals (heuristics and/or AI).
4. **crashstack** — crash/sanitizer stack traces (field + heuristics and/or AI).
5. **AI-detected STR** — AI finds clear reproduction steps in text.
6. **AI-detected test-attached** — AI finds testcase referenced/linked in text.

Important semantic rule:
- **`test-attached` is never set from AI**.
- **`AI-detected test-attached` is set only from AI**.

Has STR suggestion rule:
- If any of `test-attached`, `fuzzy-test-attached`, `AI-detected STR`, or `AI-detected test-attached` applies **but** Bugzilla’s `cf_has_str` is not set, the UI should suggest setting `Has STR` on Bugzilla and provide a one-click action.

---

## Architecture: Pure Vanilla JS (No Build Step)

The frontend is **100% pure HTML/CSS/JavaScript** with ES modules:

- **No frameworks** (React, Vue, etc.)
- **No bundlers** (Webpack, Vite build, etc.)
- **No transpilation** (TypeScript, Babel, etc.)
- **No npm required to run** - works directly in browser

### For Users

Just open `index.html` via any static server (GitHub Pages, Python http.server, etc.). The browser loads ES modules directly - no build step needed.

### For Developers

The `package.json` in `frontend/` contains **dev dependencies only** (Vitest for testing). These are optional and only needed if you want to run tests locally:

```bash
cd frontend
npm install   # Only needed for testing
npm test      # Run tests
```

The `node_modules/` folder is gitignored and not required for the app to function.

---

## Quick start (frontend only)

### 1) Run a static server
From `frontend/`:

```bash
python -m http.server 8000
```

Then open:
- http://localhost:8000

> A static server is recommended because `fetch('./canned-responses.md')` and module imports work more reliably than `file://`.

### 2) Configure keys (POC)
In the app’s **Settings**:
- Bugzilla host: `https://bugzilla.mozilla.org` (default)
- Bugzilla API key: optional for reads; required for write actions
- AI provider:
  - **Gemini**: browser mode supported (preferred)
  - **Claude**: browser mode supported for POC; or backend mode (recommended)
  - **OpenAI**: backend mode recommended

---

## Optional: Run the Rust backend proxy

The backend is only needed if:
- an AI provider call fails due to CORS, OR
- Bugzilla write calls (set `cf_has_str`, post comments) fail due to CORS, OR
- you want to use **Claude Code CLI** authentication (`CLAUDE_BACKEND_MODE=cli`).

```bash
cd backend-rust
cargo run
```

See `docs/ai-providers.md` and `backend-rust/CLAUDE.md` for environment variables and routing.

---

## User manual (POC)

### Load bugs
The app supports three ways:
1. **Manual IDs**: paste `12345 23456` or `12345,23456` then “Load”.
2. **Bugzilla REST URL**: paste `/rest/bug?...` or full URL, then “Load”.
3. **Bugzilla buglist URL (`buglist.cgi`)**: paste full `buglist.cgi?...` URL. The app maps it to REST search; if it can’t, it will prompt you to copy the REST link from Bugzilla.

### Process bugs
- “Process” per bug: runs tagging + AI (if configured) for that bug.
- “Process all”: runs on all loaded bugs.

### Read summaries
- Each bug has a “Summary” control.
- Click to expand a row below with the AI-generated brief summary.

### Filter
- Tag filter: show bugs matching all selected tags.
- Difference filter: show bugs that have all tags in **Include** and none in **Exclude**.

### Set `Has STR` on Bugzilla
- If the tool suggests `Has STR`, click “Set Has STR” next to the bug.
- If direct write fails (CORS), switch Bugzilla writes to backend proxy mode.

### Canned responses
- Maintain a response library:
  - Edit in the UI, or
  - Import from Markdown (`.md`) following `docs/canned-responses-spec.md`.
- Per bug:
  - Select a canned response → optionally “Customize with AI”.
  - Or “AI suggest” a response from your list.
- Copy draft reply or post it as a Bugzilla comment (if enabled).

---

## Outputs / export
- Download results as **JSON**, **CSV**, and **Markdown**.
- Exports include:
  - computed tags
  - `hasStrSuggested`
  - AI brief summary
  - AI provider metadata (non-secret)

See `docs/export-formats.md`.

---

## Project docs

- `docs/architecture.md` — full architecture, modules, data flow
- `docs/ai-providers.md` — Gemini/Claude/OpenAI support + Claude Code CLI mode
- `docs/tags-and-heuristics.md` — tag logic and evidence sources
- `docs/export-formats.md` — JSON/CSV/MD output schemas
- `docs/canned-responses-spec.md` — Markdown spec for canned responses (v1)
- `docs/canned-responses-conversion-guide.md` — prompt-able guide to convert your existing responses

---

## Non-goals (for this POC)
- Large-scale bug lists (hundreds/thousands) with heavy pagination/virtualization.
- Perfect 1:1 reproduction of every advanced `buglist.cgi` query (we support best-effort mapping + REST-link fallback).
- Fully automated Bugzilla actions without user review (AI never posts automatically).

