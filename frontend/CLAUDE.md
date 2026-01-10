# Claude Code Instructions (Frontend)

## Stack
- Pure HTML/CSS/JS
- ES modules
- No frameworks

## Entry points
- `frontend/index.html` loads `src/app.js`

## Module map

- `src/app.js`
  - wiring, orchestration, event handlers
- `src/bugzilla.js`
  - Bugzilla REST fetch
  - buglist.cgi parsing + mapping
  - JSONP fallback for GET-only
- `src/ai.js`
  - provider abstraction
  - tasks: classify, customize response, suggest response
- `src/tags.js`
  - tag computation + evidence
  - enforce test-attached semantics
- `src/ui.js`
  - DOM rendering
  - expandable summary rows
  - response composer panel
- `src/filters.js`
  - tag filters + difference filters + presets
- `src/cannedResponses.js`
  - load defaults from `canned-responses.md` if present
  - import `.md` by spec
  - save to localStorage
- `src/exports.js`
  - JSON/CSV/Markdown export
- `src/storage.js`
  - localStorage wrapper

## Frontend rules

- Never put API keys into exports.
- Do not conflate AI tags with non-AI tags.
- Keep UI accessible:
  - buttons for expand/collapse summary should use `aria-expanded`.

## Canned responses Markdown

- Must follow `docs/canned-responses-spec.md`.
- Import UI should allow merge or replace.

