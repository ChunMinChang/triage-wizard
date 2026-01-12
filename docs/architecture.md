# Architecture & Design (POC)

## 1. Guiding principles

- **Client-first**: The frontend does as much as possible locally.
- **Framework-free**: Pure HTML/CSS/JS ES modules.
- **Configurable AI**: Gemini + Claude are first-class; OpenAI supported; custom endpoints possible.
- **Optional backend**: A minimal Rust proxy exists only for CORS/security constraints or Claude Code CLI mode.
- **Small lists**: Typical bug count ≤ 20, so we can favor correctness and richer context over optimization.

---

## 2. Repo layout

```text
bug-triage-helper/
  CLAUDE.md
  README.md
  /frontend
    CLAUDE.md
    index.html
    styles.css
    canned-responses.md              # optional repo default
    /src
      app.js
      ui.js
      bugzilla.js
      ai.js
      tags.js
      filters.js
      cannedResponses.js
      exports.js
      storage.js
      config.js
  /backend-rust
    CLAUDE.md
    Cargo.toml
    src/
      main.rs
      ai_proxy.rs
      bugzilla_proxy.rs
      cli_claude.rs
  /docs
    architecture.md
    ai-providers.md
    tags-and-heuristics.md
    export-formats.md
    canned-responses-spec.md
    canned-responses-conversion-guide.md
```

---

## 3. High-level data flow

### 3.1 Bug ingestion
User provides one of:
- Bug IDs
- `/rest/bug?...` REST URL (or query string)
- `buglist.cgi?...` URL (hard requirement)
- Uploaded results JSON (previous run)

Frontend loads:
1. Bug metadata via Bugzilla REST.
2. Attachments.
3. Comments (including description = comment 0).

### 3.2 Tagging
Per bug, the app computes:
- **Bugzilla-field tags**: `Has STR` from `cf_has_str`.
- **Heuristic tags**: `test-attached`, `fuzzy-test-attached`, `crashstack` from metadata+attachments+text.
- **AI tags** (optional): `AI-detected STR`, `AI-detected test-attached`, plus AI confirmation signals.

Then:
- Compute `hasStrSuggested` if tags imply STR but Bugzilla field isn’t set.

### 3.3 Summaries
If AI is enabled:
- Store `summary` (brief) per bug.
- UI shows a clickable/expandable summary row.

### 3.4 Canned response recommendation
User may:
- Select canned response → optionally AI-customize.
- Ask AI to suggest best response from list.
- Copy draft reply or (optionally) post to Bugzilla.

---

## 4. Frontend module responsibilities

### `app.js`
- Wires UI event handlers.
- Orchestrates bug loading, processing, and exports.

### `bugzilla.js`
- Bugzilla REST integration.
- Supports:
  - `loadByIds()`
  - `loadByRestUrl()`
  - `loadByBuglistUrl()` (parsing + mapping)
- If CORS fails, shows error suggesting backend proxy mode.

### `ai.js`
- AI provider abstraction:
  - Gemini, Claude, OpenAI, Grok, Custom
- Supports transport:
  - `browser` (direct fetch)
  - `backend` (proxy)
- AI tasks:
  1) classify bug (tags + brief summary)
  2) customize canned response
  3) suggest canned response

### `tags.js`
- Pure logic.
- Enforces key semantic rule:
  - `test-attached` is non-AI only.
  - `AI-detected test-attached` is AI only.
- Calculates `hasStrSuggested`.

### `ui.js`
- Renders bug list table, badges, buttons.
- Adds expandable summary rows.
- Provides response composer UI per bug.

### `filters.js`
- Tag filter and difference filter.
- Presets:
  - “AI STR but no Has STR”
  - “AI STR + AI test-attached but no test-attached & no Has STR”
  - “Fuzzing testcase”

### `cannedResponses.js`
- Stores response library in memory.
- Loads defaults from:
  - `frontend/canned-responses.md` (optional fetch)
- Imports user `.md` file per spec.
- Persists user overrides to localStorage.

### `exports.js`
- JSON/CSV/Markdown export.
- Includes tags, summary, provider meta.

### `storage.js`
- localStorage wrapper for keys and UI settings.

---

## 5. Backend (optional) responsibilities

### When backend is needed
- AI provider does not support browser calls due to CORS.
- Bugzilla write operations blocked by CORS.
- Want to avoid keys in browser.
- Want to use **Claude Code CLI** auth and tooling.

### Endpoints (suggested)
- `POST /api/ai/classify` — bug classification + brief summary
- `POST /api/ai/customize-response` — customize selected canned response
- `POST /api/ai/suggest-response` — choose best canned response and draft
- `POST /api/bugzilla/set-has-str` — set `cf_has_str`
- `POST /api/bugzilla/post-comment` — post comment (optional)

Backend returns provider-agnostic JSON so frontend doesn’t care whether a request was served via:
- direct provider HTTP API, or
- Claude Code CLI mode.

---

## 6. Security & privacy (POC posture)

- Browser-mode keys are **BYOK** and may be stored in localStorage only if user opts in.
- Backend proxy mode keeps keys on localhost and out of browser.
- Claude Code CLI mode relies on local `claude` authentication (env vars or CLI login state).
- AI calls should not include unnecessary secrets; only bug content is sent.
- AI never performs irreversible actions (posting, setting fields) without explicit user click.

---

## 7. Known limitations

- `buglist.cgi` mapping is best-effort for advanced queries; fallback is to prompt user to paste REST link.
- CORS failures prompt user to use backend proxy mode; writes may require backend.
- Very large bug/comment payloads may hit provider context limits; POC prioritizes completeness.

---

## 8. Implementation phases

1. Frontend skeleton + Bugzilla read-only fetch + table rendering.
2. Attachment/comment fetch + heuristic tags + filters.
3. AI integration (Gemini first) → classification + summary.
4. Add Claude (browser + backend) + OpenAI support (backend recommended).
5. Add `Has STR` writeback + optional backend proxy.
6. Canned response library (Markdown import + UI) + AI customization/suggestion.
7. Exports/imports + polish.

