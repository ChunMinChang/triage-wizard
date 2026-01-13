# Mozilla Bugzilla Bug Triage Helper - Implementation Plan

**Project Status**: Greenfield (documentation complete, no code implementation yet)

**Approach**: Frontend + Backend together, TDD, Claude & Gemini browser mode prioritized

**Plan File Location**: This file (`IMPLEMENTATION_PLAN.md`) + Claude's plan file at `~/.claude/plans/ticklish-plotting-valiant.md`

**Testing Framework**: Vitest (primary) + Jest/jsdom (supplementary if needed)

**Hosting**: GitHub Pages (auto-deploy via GitHub Actions)

---

## Deployment Requirements

The frontend must be hostable on **GitHub Pages** so Mozilla developers can use it directly without local setup.

**Key constraints:**
- Pure vanilla JS (no build step, no bundlers)
- Browser loads ES modules directly via `<script type="module">`
- npm/node_modules are for testing only, not required to run the app
- All functionality works client-side (backend is optional)

**Deployment workflow:**
- `.github/workflows/deploy-pages.yml` auto-deploys `frontend/` to GitHub Pages
- Triggered on push to `main` branch (paths: `frontend/**`)
- To enable: Repo Settings → Pages → Source: "GitHub Actions"

---

## Implementation Workflow (Reference for All Development Sessions)

When working on any task in this plan, follow this TDD workflow:

1. **Select Task**: Pick a task with status "Pending" whose dependencies are "Complete"
2. **Mark Processing**: Change task status from "Pending" → "Processing"
3. **Design Verification**: Think about and document how this task will be verified (expected results, acceptance criteria)
4. **Write Tests**: Write tests for the selected "Processing" task BEFORE implementation
5. **Implement**: Work on the task implementation
6. **Run Tests**: Execute written tests to verify implementation
7. **Iterate**: If tests fail, repeat steps 5-6 until all tests pass
8. **Verify**: Once tests pass, perform manual verification per task's verification criteria
9. **Mark Complete**: Change task status from "Processing" → "Complete"
10. **Commit**: Create git commit with clear message describing what was implemented

**Rules**:
- Only ONE task should be "Processing" at a time (enforced)
- Tests must be written BEFORE implementation
- All tests must pass before marking "Complete"
- Commit after each completed task (atomic commits)

---

## Task Status Legend

- **[PENDING]**: Not started, waiting for dependencies
- **[PROCESSING]**: Currently being worked on (max 1 task)
- **[COMPLETE]**: Implemented, tested, verified, committed

---

## Current Todo List (Updated During Development)

### Layer 0: Foundation (5 tasks)
- [x] L0-F1: Frontend HTML Skeleton ★ (CRITICAL PATH) ✓
- [x] L0-F3: Frontend Directory Structure + Vitest Setup ★ (CRITICAL PATH) ✓
- [ ] L0-B1: Rust Backend Scaffold
- [x] L0-F2: Basic CSS Foundation ✓
- [x] L0-F4: Storage Module (depends on L0-F3) ✓

### Layer 1 (complete)
- [x] L1-F1: Config Module ★ ✓
- [x] L1-F2: Bugzilla REST Integration ★ (HIGHEST IMPACT) ✓
- [x] L1-F3: Basic UI Rendering ✓
- [x] L1-F4: App Orchestration ★ ✓

### Layer 2: Tagging & Filtering (complete)
- [x] L2-F1: Heuristic Tagging ★ (CORE LOGIC) ✓
- [x] L2-F2: Tag Display ✓
- [x] L2-F3: Filter Engine ✓
- [x] L2-F4: Filter UI ✓

### Layer 3: AI Integration (in progress)
- [x] L3-F1: AI Provider Abstraction ★ ✓
- [ ] L3-F2: Gemini Browser Integration
- [ ] L3-F3: Claude Browser Integration
- [ ] L3-F4: AI UI Integration

---

## Dependencies & Critical Path

```
Legend: → (blocks), ★ (critical path)

L0-F1 ★ → L1-F3 → L2-F2 → L2-F4
  ↓
L0-F3 ★ → L1-F1 ★ → L1-F2 ★ → L1-F4 ★ → L2-F1 ★ → L2-F3
            ↓                                  ↓
          L3-F1 ★ ────────────────────────→ L3-F4 ★
            ↓
      L3-F2, L3-F3 (parallel)
```

**Critical Path Tasks** (must be completed in order for core functionality):
1. L0-F1 (HTML skeleton) ✓
2. L0-F3 (Module structure) ✓
3. L1-F1 (Config module) ✓
4. L1-F2 (Bugzilla integration) ← **HIGHEST IMPACT** ✓
5. L1-F4 (App orchestration) ✓
6. L2-F1 (Heuristic tagging) ← **CORE LOGIC** ✓
7. L3-F1 (AI abstraction) ← **ENABLES AI FEATURES** ✓
8. L3-F4 (AI UI integration)

---

## Quick Reference: Task Dependencies (Topological Order)

### Foundation Layer (Complete First)
1. **L0-F1** (HTML skeleton) → enables L0-F2, L1-F3
2. **L0-F3** (Module structure) → enables all frontend modules
3. **L0-F4** (Storage) → enables L1-F1
4. **L0-B1** (Backend scaffold) → enables all backend features

### Critical Path (Core Value)
5. **L1-F1** (Config) → enables L1-F2, L3-F1
6. **L1-F2** (Bugzilla integration) ★ HIGHEST IMPACT → enables L1-F4, L2-F1
7. **L1-F3** (UI rendering) → enables L2-F2, L3-F4
8. **L1-F4** (App orchestration) → enables processing workflow
9. **L2-F1** (Heuristic tagging) ★ CORE LOGIC → enables L2-F2, L2-F3
10. **L2-F2** (Tag display) → enables L2-F4, L4-F3
11. **L2-F3** (Filter engine) → enables L2-F4
12. **L2-F4** (Filter UI) → enhances workflow
13. **L3-F1** (AI abstraction) ★ ENABLES AI → enables L3-F2, L3-F3, L4-F4, L4-F5
14. **L3-F2** (Gemini) → enables L3-F4
15. **L3-F3** (Claude) → enables L3-F4
16. **L3-F4** (AI UI integration) → completes AI workflow

---

## Critical Files to be Created/Modified

### Frontend Core (Critical Path)
- `frontend/index.html` - Entry point (L0-F1)
- `frontend/styles.css` - All styling (L0-F2)
- `frontend/src/bugzilla.js` - Bugzilla REST API (L1-F2) ★ HIGHEST IMPACT
- `frontend/src/tags.js` - Tag computation, semantic rules (L2-F1) ★ CORE LOGIC
- `frontend/src/ai.js` - AI provider abstraction (L3-F1) ★ ENABLES AI
- `frontend/src/app.js` - Orchestration (L1-F4)
- `frontend/src/ui.js` - DOM rendering (L1-F3, L2-F2, L3-F4)

### Frontend Support
- `frontend/src/config.js` - Settings management (L1-F1)
- `frontend/src/storage.js` - localStorage wrapper (L0-F4)
- `frontend/src/filters.js` - Filtering logic (L2-F3)
- `frontend/src/cannedResponses.js` - Response library (L4-F1, L4-F2)
- `frontend/src/exports.js` - Export/import (L4-F8, L4-F9)
- `frontend/canned-responses.md` - Sample responses (L4-F10)

### Frontend Testing & Config
- `frontend/package.json` - Node deps + test scripts (L0-F3)
- `frontend/vitest.config.js` - Vitest configuration (L0-F3)
- `frontend/src/__tests__/` - Test files directory (L0-F3)

### Backend (Optional)
- `backend-rust/Cargo.toml` - Dependencies (L0-B1)
- `backend-rust/src/main.rs` - Server setup (L0-B1)
- `backend-rust/.env.example` - Environment template (L0-B1)
- `backend-rust/src/ai_proxy.rs` - AI proxy (L3-B1)
- `backend-rust/src/cli_claude.rs` - Claude CLI (L3-B2)
- `backend-rust/src/bugzilla_proxy.rs` - Bugzilla proxy (L4-B1)

---

## Estimated Timeline

- **Week 1**: Layer 0 + Layer 1 (Foundation + Core Data Flow)
- **Week 2**: Layer 2 (Tagging & Filtering)
- **Week 3**: Layer 3 (AI Integration) + L0-B1 (Backend scaffold)
- **Week 4**: Layer 4 (Advanced Features)
- **Week 5**: Layer 5 (Polish & Testing)

**Total**: 5 weeks for full implementation (frontend + backend, TDD approach)

---

## FULL TASK LIST

See below for the complete detailed task breakdown for all 70+ tasks across 5 layers.

---

## LAYER 0: Project Scaffolding (Foundation)

### L0-F1: Frontend HTML Skeleton ★
**Status**: [COMPLETE]
**Priority**: Foundation (CRITICAL PATH)
**Complexity**: Simple (1-2 hours)
**Dependencies**: None
**Blocks**: L0-F2, L1-F3, all UI work

**Description**: Create `frontend/index.html` with:
- Basic HTML5 structure, meta tags (charset, viewport)
- Load `src/app.js` as ES module via `<script type="module">`
- Link to `styles.css`
- Semantic structure: settings section, bug input section, filter controls, bug table container, export buttons

**Verification**:
- Open `http://localhost:8000`, page loads without errors
- DevTools Console: no 404 errors for JS/CSS
- Can see basic HTML structure (even if unstyled)

**Tests**:
- Manual: Start `python -m http.server 8000` in frontend/, load browser
- Check DevTools Network tab: all resources load (200 OK)

**Files**: `frontend/index.html`

---

### L0-F2: Basic CSS Foundation
**Status**: [COMPLETE]
**Priority**: Foundation
**Complexity**: Simple (1-2 hours)
**Dependencies**: L0-F1
**Blocks**: UI polish (L5-F3)

**Description**: Create `frontend/styles.css` with:
- CSS reset/normalization
- Layout (flexbox/grid for sections)
- Table styling, button/form controls
- Badge styles (colored pills for tags)
- Utility classes for expandable sections

**Verification**:
- Page has readable layout
- Focus states visible on tab navigation
- Responsive on 768px+ widths

**Tests**:
- Visual inspection in Chrome/Firefox
- Test keyboard Tab navigation, verify focus indicators

**Files**: `frontend/styles.css`

---

### L0-F3: Frontend Directory Structure + Vitest Setup ★
**Status**: [COMPLETE]
**Priority**: Foundation (CRITICAL PATH)
**Complexity**: Simple (1 hour)
**Dependencies**: None
**Blocks**: All module implementation

**Description**: Create frontend module structure and testing setup:

1. **Module files** in `frontend/src/` with JSDoc placeholders:
   - `app.js`, `bugzilla.js`, `ai.js`, `tags.js`, `filters.js`, `ui.js`, `cannedResponses.js`, `exports.js`, `storage.js`, `config.js`
   - Each file: JSDoc comment describing purpose, export placeholder functions

2. **Testing setup**:
   - Create `frontend/package.json` with Vitest as dev dependency
   - Create `frontend/vitest.config.js` for ES module testing
   - Configure test scripts: `npm test`, `npm run test:watch`
   - Create `frontend/src/__tests__/` directory for test files

**Verification**:
- Import all modules from app.js succeeds
- Console.log from each module shows execution
- `npm test` runs successfully (even with no tests yet)

**Tests**:
- Add test imports in app.js: `console.log('Module loaded')`
- Verify console output in browser
- Run `npm test` to verify Vitest setup

**Files**:
- All `frontend/src/*.js`
- `frontend/package.json`
- `frontend/vitest.config.js`

---

### L0-F4: Storage Module (localStorage Wrapper)
**Status**: [COMPLETE]
**Priority**: Foundation
**Complexity**: Simple (1 hour)
**Dependencies**: L0-F3
**Blocks**: L1-F1 (Config)

**Description**: Implement `frontend/src/storage.js`:
- `getConfig(key, defaultValue)` - retrieve config from localStorage
- `setConfig(key, value)` - save config to localStorage
- `getAllConfig()` - get all config as object
- Namespace keys with prefix `btw_`
- Handle localStorage exceptions (quota, unavailable)

**Verification**:
- Save/load various data types (string, number, object, array)
- Values persist across page reload
- Graceful fallback if localStorage unavailable (private browsing)

**Tests**:
- Unit tests: save string, reload, verify retrieval
- Test with objects (JSON serialization)
- DevTools → Application → Local Storage (verify keys)

**Files**: `frontend/src/storage.js`

---

### L0-B1: Rust Backend Scaffold
**Status**: [PENDING]
**Priority**: Foundation
**Complexity**: Simple (2 hours)
**Dependencies**: None
**Blocks**: All backend features (L3-B1, L4-B1)

**Description**: Create `backend-rust/Cargo.toml` and `src/main.rs`:
- Dependencies: `tokio`, `axum`, `serde`, `serde_json`, `reqwest`, `tower-http`, `dotenvy`
- Basic Axum server on port 3000
- CORS middleware for `localhost:8000`
- Health check endpoint: `GET /health` returns 200 OK
- Environment variable loading via dotenvy

**Environment setup** - Create `.env.example`:
```
# AI Provider API Keys
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
GROK_API_KEY=

# Claude Backend Mode: api (HTTP API) or cli (Claude Code CLI)
CLAUDE_BACKEND_MODE=api

# Bugzilla API Key (optional, for server-side key usage)
BUGZILLA_API_KEY=
```

**Verification**:
- `cargo run` compiles and starts server
- `curl http://localhost:3000/health` returns 200
- Fetch from browser console succeeds (CORS)
- Environment variables load correctly

**Tests**:
- Manual: Run `cd backend-rust && cargo run`
- Test: `curl http://localhost:3000/health`
- Browser DevTools: `fetch('http://localhost:3000/health').then(r => r.text())`

**Files**: `backend-rust/Cargo.toml`, `backend-rust/src/main.rs`, `backend-rust/.env.example`

---

## LAYER 1-5: Remaining Tasks

See the original plan file at `~/.claude/plans/ticklish-plotting-valiant.md` for all remaining tasks (L1-F1 through L5-B1).

**Layers**:
- **Layer 1**: Core Data Flow (Config, Bugzilla, UI, App orchestration) - 4 tasks
- **Layer 2**: Tagging & Filtering (Heuristic tags, display, filters) - 4 tasks
- **Layer 3**: AI Integration (Provider abstraction, Gemini, Claude, UI integration, backend proxy) - 6 tasks
- **Layer 4**: Advanced Features (Canned responses, exports, Bugzilla writeback) - 10 tasks
- **Layer 5**: Polish & Testing (Settings UI, error handling, responsive, accessibility, docs, E2E tests) - 6 tasks

**Total**: 35 tasks across all layers

---

## Verification Plan (End-to-End)

After all tasks complete, verify the entire system works:

### 1. Basic Workflow
- [ ] Start frontend: `cd frontend && python -m http.server 8000`
- [ ] Load in browser: `http://localhost:8000`
- [ ] Configure: Settings → Bugzilla host + AI provider (Gemini/Claude with API key)
- [ ] Load bugs: Paste bug IDs "123456 234567" → click Load
- [ ] Verify: Bug table populates with data

### 2. Tagging & Filtering
- [ ] Process: Click "Process All" → verify heuristic tags appear
- [ ] AI: Click "Process" on individual bug → verify AI tags and summary
- [ ] Filter: Select tags → Apply Filter → verify filtered results

### 3. Canned Responses
- [ ] Load: Verify default canned-responses.md loads
- [ ] Select: Click "Respond" → select response → verify populated
- [ ] Customize: Click "Customize with AI" → verify AI draft appears

### 4. Bugzilla Writeback (Optional)
- [ ] Set Has STR: Click "Set Has STR" → verify Bugzilla updated
- [ ] Post Comment: Draft response → "Post to Bugzilla" → verify comment posted

### 5. Export/Import
- [ ] Export: Click "Export JSON" → verify file downloads
- [ ] Import: Upload JSON → verify bugs restored

### 6. Backend (Optional)
- [ ] Start backend: `cd backend-rust && cargo run`
- [ ] Switch to backend mode → verify AI calls work

### 7. Cross-Browser & Accessibility
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test keyboard navigation
- [ ] Lighthouse audit: Accessibility score ≥90

---

## Risk Areas to Watch

1. **Bugzilla API Parsing (L1-F2)**: Test with diverse bug types, document assumptions
2. **AI CORS (L3-F2, L3-F3)**: Have backend proxy ready as fallback
3. **Tag Semantic Rule (L2-F1)**: Strict validation that AI never sets `test-attached`
4. **Bugzilla Writeback (L4-F6, L4-F7)**: Use sandbox for testing, confirmation dialogs

---

## Notes

- All tasks start as **[PENDING]**
- Update task status: [PENDING] → [PROCESSING] → [COMPLETE]
- Follow TDD workflow (write tests before implementation)
- Commit after each completed task (atomic commits)
- Reference this plan at the start of each development session
- For full task details, see `~/.claude/plans/ticklish-plotting-valiant.md`
