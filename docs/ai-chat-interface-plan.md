# AI Chat Interface Feature Plan

## Progress Tracking

**Last Updated**: 2026-01-21

| Sprint | Status | Tasks |
|--------|--------|-------|
| Sprint 0 (Research) | ✅ COMPLETE | T0 |
| Sprint 1 (Foundation) | ✅ COMPLETE | T1, T2, T3, T4 |
| Sprint 2 (Infrastructure) | 🔄 IN PROGRESS | T5, T6, T7, T8 |
| Sprint 3 (Core) | ⏳ Pending | T9, T10, T11, T12 |
| Sprint 4 (Interactive) | ⏳ Pending | T13, T14, T15, T18 |
| Sprint 5 (Polish) | ⏳ Pending | T16, T17, T19, T20, T21 |

### Completed Files
- `docs/claude-integration-research.md` - T0 research findings
- `frontend/src/chatModels.js` - T1 data models
- `frontend/src/chatProtocol.js` - T2 WebSocket protocol
- `frontend/src/analysisFormat.js` - T3 persistence format
- `frontend/styles.css` - T4 chat UI styles (added ~400 lines)

### Next Up
- T5: Chat Storage (write tests first, then implement)
- T6: WebSocket Backend Endpoint
- T7: Analysis Export/Import
- T8: Chat UI Component

---

## Overview

Transform the triage-wizard from a one-shot AI analysis tool into an interactive, conversational bug triage assistant—bringing the power of the [Claude Code triage skill](https://github.com/ChunMinChang/dotfiles/tree/master/mozilla/firefox/dot.claude/skills/triage) into a web UI.

---

## Design Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| **Chat UI Layout** | Resizable slide-out drawer (user can drag to resize width) |
| **Codebase Access** | Three tiers: Local repo (full), Searchfox (online), None (limited) |
| **Claude Integration** | Research spike first: evaluate CLI `--resume` vs HTTP API |
| **Storage** | localStorage + file export (download/upload analysis files) |

---

## Development Methodology: Test-Driven Development (TDD)

All tasks follow a strict TDD workflow to ensure reliability and prevent regressions:

### TDD Cycle for Each Task

```
┌─────────────────────────────────────────────────────────────────┐
│  1. WRITE TESTS FIRST                                           │
│     - Define expected behavior with test cases                  │
│     - Tests should FAIL initially (no implementation yet)       │
│     - Cover edge cases, error handling, happy paths             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. IMPLEMENT THE FEATURE                                       │
│     - Write minimal code to make tests pass                     │
│     - Follow the module patterns established in the codebase    │
│     - Keep implementation focused on test requirements          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RUN TESTS & VERIFY                                          │
│     - All new tests should PASS                                 │
│     - All existing tests should still PASS (no regressions)     │
│     - Run: `cd frontend && npm test`                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. REFACTOR (if needed)                                        │
│     - Clean up code while keeping tests green                   │
│     - Improve readability, remove duplication                   │
└─────────────────────────────────────────────────────────────────┘
```

### Test File Locations

| Module | Test File |
|--------|-----------|
| `frontend/src/chatModels.js` | `frontend/src/__tests__/chatModels.test.js` |
| `frontend/src/chatProtocol.js` | `frontend/src/__tests__/chatProtocol.test.js` |
| `frontend/src/analysisFormat.js` | `frontend/src/__tests__/analysisFormat.test.js` |
| `frontend/src/chatStorage.js` | `frontend/src/__tests__/chatStorage.test.js` |
| `frontend/src/chatClient.js` | `frontend/src/__tests__/chatClient.test.js` |
| `backend-rust/src/chat_handler.rs` | `backend-rust/tests/chat_handler_test.rs` |

### Test Commands

```bash
# Frontend tests (Vitest)
cd frontend
npm test              # Run all tests
npm test -- --watch   # Watch mode for development
npm test chatModels   # Run specific test file

# Backend tests (Cargo)
cd backend-rust
cargo test            # Run all tests
cargo test chat       # Run tests matching "chat"
```

### Why TDD?

1. **Prevents Regressions**: When implementing T8, we won't accidentally break T5
2. **Documents Behavior**: Tests serve as executable documentation
3. **Enables Refactoring**: Safe to improve code when tests catch breakage
4. **Catches Edge Cases Early**: Forces thinking about error conditions upfront
5. **Faster Debugging**: Failing test pinpoints exactly what broke

---

## Current State vs. Target State

| Aspect | Current | Target |
|--------|---------|--------|
| AI Interaction | One-shot requests (classify, refine) | Multi-turn conversation |
| Context | Single request, no memory | Persistent per-bug sessions |
| Codebase Access | None | Three tiers: Local / Searchfox / None |
| User Input | Pre-defined options only | Free-form chat + structured prompts |
| Permission Handling | N/A | Forward AI permission requests to user |
| Persistence | Tags/summary only | Full analysis + chat history + file export |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Chat Interface                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ ChatSession  │  │ MessageList  │  │ ChatInput    │      │   │
│  │  │ (per bug)    │  │ (streaming)  │  │ (+ commands) │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  │                           │                                  │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │ PermissionHandler - forwards AI permission requests   │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ WebSocket/SSE                        │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend (Rust + Axum)                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ /api/chat/stream - WebSocket endpoint for conversation      │   │
│  │                                                              │   │
│  │  ┌──────────────────┐     ┌──────────────────┐             │   │
│  │  │ SessionManager   │────▶│ Claude CLI       │             │   │
│  │  │ (per-bug state)  │     │ (long-running)   │             │   │
│  │  └──────────────────┘     └────────┬─────────┘             │   │
│  │                                     │                       │   │
│  │  ┌──────────────────┐              │                       │   │
│  │  │ CodebaseProxy    │◀─────────────┘                       │   │
│  │  │ (file access)    │                                       │   │
│  │  └──────────────────┘                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌──────────┐    ┌──────────────┐  ┌──────────────┐
       │ Bugzilla │    │ Firefox Repo │  │ Claude API   │
       │ REST API │    │ (REQUIRED)   │  │ (or CLI)     │
       └──────────┘    └──────────────┘  └──────────────┘
```

---

## Technical Approach

### Streaming Protocol: WebSocket
- Bidirectional communication for real-time chat
- Handles permission requests inline
- Single connection per chat session

### Codebase Access Model (Three Tiers)

**Tier 1: Local Codebase (Full Power)**
- User provides Firefox repo path at first chat session
- Backend validates path (checks for `mach` or `.gecko-dir`)
- Backend spawns Claude CLI in that directory
- Permission requests forwarded to user through WebSocket
- AI can read any file, search code, understand context deeply

**Tier 2: Searchfox Online (Medium Power)**
- User declines local codebase but opts into searchfox.org
- AI uses WebFetch to search https://searchfox.org/mozilla-central/
- Can find files, read code, but slower and less context
- No permission prompts needed (public data)

**Tier 3: No Codebase (Basic Mode)**
- User declines both local and online codebase access
- AI analyzes bug without code investigation
- Skip Phase 4 (Investigation) or provide limited analysis
- Inform user: "Analysis limited - no codebase access"

**UI Flow at Session Start**:
```
┌─────────────────────────────────────────────────────────┐
│  Firefox Codebase Access                                │
│                                                         │
│  For deeper analysis, Claude can investigate Firefox    │
│  source code. Choose an option:                         │
│                                                         │
│  ○ Local repository (fastest, most powerful)            │
│    Path: [/home/user/mozilla-unified    ] [Browse]     │
│                                                         │
│  ○ Search online via searchfox.org (slower)             │
│    No local files needed                                │
│                                                         │
│  ○ Skip code investigation                              │
│    Analysis will be limited to bug data only            │
│                                                         │
│  [Continue]                                             │
└─────────────────────────────────────────────────────────┘
```

### Analysis Persistence Format
- YAML frontmatter + Markdown body
- Human-readable, version-controllable
- Includes structured data + conversation log for context restoration

---

## Task Dependency Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          RESEARCH SPIKE (First!)                                 │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │   T0: Claude Integration Research                                        │  │
│   │   - Test `claude --resume` for conversation continuity                   │  │
│   │   - Test Claude HTTP API with message history                            │  │
│   │   - Evaluate streaming capabilities of each                              │  │
│   │   - Decision: which approach to use for T6                               │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                     FOUNDATION LAYER                             │
                    │  (Can start in parallel after T0)                                │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
                    │   │   T1    │    │   T2    │    │   T3    │    │   T4    │    │
                    │   │ Data    │    │ Backend │    │Analysis │    │ Chat UI │    │
                    │   │ Models  │    │Protocol │    │ Format  │    │ Mockup  │    │
                    │   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    │
                    └────────┼──────────────┼──────────────┼──────────────┼─────────┘
                             │              │              │              │
                             ▼              ▼              ▼              ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                   INFRASTRUCTURE LAYER                           │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
                    │   │   T5    │    │   T6    │    │   T7    │    │   T8    │    │
                    │   │ Chat    │◀───│WebSocket│    │Analysis │    │ Chat UI │    │
                    │   │ Storage │    │Endpoint │    │Export/  │    │Component│    │
                    │   │         │    │         │    │Import   │    │         │    │
                    │   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    │
                    └────────┼──────────────┼──────────────┼──────────────┼─────────┘
                             │              │              │              │
                             ▼              ▼              ▼              ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                      CORE LAYER                                  │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
                    │   │   T9    │◀───│  T10    │    │  T11    │    │  T12    │    │
                    │   │Streaming│    │ Context │    │Codebase │    │ Phase   │    │
                    │   │ Display │    │ Manager │    │ Config  │    │Workflow │    │
                    │   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    │
                    └────────┼──────────────┼──────────────┼──────────────┼─────────┘
                             │              │              │              │
                             ▼              ▼              ▼              ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                   INTERACTIVE LAYER                              │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐                    │
                    │   │  T13    │    │  T14    │    │  T15    │                    │
                    │   │Permission│    │Codebase │    │ Bug UI  │                    │
                    │   │Forwarding│    │ Proxy   │    │Integrate│                    │
                    │   └────┬────┘    └────┬────┘    └────┬────┘                    │
                    └────────┼──────────────┼──────────────┼──────────────────────────┘
                             │              │              │
                             ▼              ▼              ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                    ADVANCED LAYER                                │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐                    │
                    │   │  T16    │    │  T17    │    │  T18    │                    │
                    │   │ Resume  │    │Analysis │    │ Initial │                    │
                    │   │ Session │    │  Diff   │    │ Prompts │                    │
                    │   └────┬────┘    └────┬────┘    └────┬────┘                    │
                    └────────┼──────────────┼──────────────┼──────────────────────────┘
                             │              │              │
                             ▼              ▼              ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                     POLISH LAYER                                 │
                    │                                                                  │
                    │   ┌─────────┐    ┌─────────┐    ┌─────────┐                    │
                    │   │  T19    │    │  T20    │    │  T21    │                    │
                    │   │ History │    │ E2E     │    │  Docs   │                    │
                    │   │ Search  │    │ Testing │    │         │                    │
                    │   └─────────┘    └─────────┘    └─────────┘                    │
                    └─────────────────────────────────────────────────────────────────┘
```

---

## Task Details

### RESEARCH SPIKE (Before All Else)

#### T0: Claude Integration Research
**Priority**: P0 (BLOCKING - must complete before T6)
**Effort**: Medium (1-2 days exploration)

Investigate two approaches for conversational Claude integration:

**Option A: Claude CLI with `--resume`**
```bash
# Test if this works programmatically
claude --resume <session-id> -p "follow-up message"
```
- Can we capture session ID from initial call?
- Does it maintain full context including file reads?
- How does streaming work with resume?

**Option B: Claude HTTP API with message history**
```javascript
// Anthropic API with conversation history
{
  model: "claude-sonnet-4-5-20250929",
  messages: [
    { role: "user", content: "initial prompt with bug context" },
    { role: "assistant", content: "previous analysis..." },
    { role: "user", content: "follow-up question" }
  ],
  stream: true
}
```
- Full control over conversation flow
- Requires API key server-side
- Native streaming support
- No file system access (would need MCP or tool calling)

**Evaluation Criteria**:
1. Conversation continuity
2. Streaming reliability
3. File system access for codebase investigation
4. Permission handling capability
5. Implementation complexity

**Output**: Decision document with chosen approach and rationale

**Files**: `docs/claude-integration-research.md` (new)

---

### FOUNDATION LAYER (Week 1)

#### T1: Design Chat Data Models
**Priority**: P0 (blocks T5, T8, T10)
**Effort**: Small

Define TypeScript-style interfaces for:
```javascript
// Chat message
{
  id: string,
  role: 'user' | 'assistant' | 'system' | 'permission-request',
  content: string,
  timestamp: number,
  metadata?: {
    phase?: 'gathering' | 'classification' | 'assessment' | 'investigation' | 'response',
    permissionType?: 'file-read' | 'file-write' | 'tool-use',
    permissionPath?: string,
    structuredData?: object  // For analysis results
  }
}

// Chat session
{
  bugId: number,
  messages: Message[],
  state: 'idle' | 'processing' | 'awaiting-permission' | 'awaiting-input',
  currentPhase: string,
  analysisResult?: AnalysisResult,
  codebasePath?: string,
  createdAt: number,
  updatedAt: number
}
```

**Files**: `frontend/src/chatModels.js` (new)

---

#### T2: Design Backend WebSocket Protocol
**Priority**: P0 (blocks T6, T9, T13)
**Effort**: Medium

Define message protocol:
```javascript
// Client → Server
{ type: 'start', bugId: number, codebasePath?: string }
{ type: 'message', content: string }
{ type: 'permission-response', allow: boolean, scope?: 'once' | 'session' }
{ type: 'cancel' }

// Server → Client
{ type: 'chunk', content: string }  // Streaming AI response
{ type: 'message-complete', messageId: string }
{ type: 'permission-request', id: string, permissionType: string, path?: string, description: string }
{ type: 'phase-change', phase: string }
{ type: 'analysis-update', data: object }  // Structured analysis results
{ type: 'error', message: string }
{ type: 'session-end' }
```

**Files**: `backend-rust/src/chat_protocol.rs` (new), `frontend/src/chatProtocol.js` (new)

---

#### T3: Design Analysis Persistence Format
**Priority**: P0 (blocks T7, T16, T17)
**Effort**: Small

Markdown format with YAML frontmatter:
```markdown
---
bug_id: 1234567
bug_summary: "Original bug title"
analyzed_at: "2024-01-15T10:30:00Z"
analysis_version: 1
codebase_path: "/home/user/mozilla-unified"
phases_completed: [gathering, classification, assessment, investigation, response]
classification:
  has_str: true
  has_testcase: false
  has_crashstack: true
  is_fuzzing: false
severity: S2
priority: P2
---

# Bug 1234567 Analysis

## Summary
[AI-generated summary]

## Classification
- **Steps to Reproduce**: Yes (documented in comment #3)
- **Test Case**: No
- **Crash Stack**: Yes (ASAN trace in description)

## Assessment
[Severity/priority reasoning]

## Code Investigation
### Relevant Files
- `dom/media/AudioContext.cpp:423` - Main entry point
- ...

### Related Bugs
- Bug 1111111 - Similar crash pattern

## Recommended Response
[Draft response]

---

## Conversation Log
[Optional: full chat history for context restoration]
```

**Files**: `frontend/src/analysisFormat.js` (new)

---

#### T4: Chat UI Mockup/Design
**Priority**: P0 (blocks T8)
**Effort**: Small

**Confirmed Design**:
- **Layout**: Resizable slide-out drawer from right
  - Drag handle on left edge to resize width
  - Default: 40% of viewport, min: 300px, max: 70%
  - Persists width preference in localStorage
- **Message Display**: Unified column with role icons (user avatar, AI icon)
- **Permission Prompts**: Inline in chat flow with action buttons
- **Phase Indicator**: Horizontal progress bar with 5 phases
- **Codebase Prompt**: First-time modal asking for Firefox repo path

**Key UI Elements**:
```
┌─────────────────────────────────────┬──────────────────────────────┐
│           Bug List (main)           │◀═══ drag ═══▶│  Chat Panel  │
│                                     │              │              │
│  ┌─────────────────────────────┐   │  ┌────────────────────────┐ │
│  │ Bug 123456 [Chat] [Process] │   │  │ Phase: ●●●○○           │ │
│  │ Bug 234567 [Chat] [Process] │   │  │ Gathering │ Classif... │ │
│  └─────────────────────────────┘   │  ├────────────────────────┤ │
│                                     │  │ [AI] Analyzing bug...  │ │
│                                     │  │ [User] What about X?   │ │
│                                     │  │ [AI] Looking at X...   │ │
│                                     │  │ ┌──────────────────┐   │ │
│                                     │  │ │ Permission: Read │   │ │
│                                     │  │ │ dom/media/foo.cpp│   │ │
│                                     │  │ │ [Allow] [Deny]   │   │ │
│                                     │  │ └──────────────────┘   │ │
│                                     │  ├────────────────────────┤ │
│                                     │  │ [Type a message...]    │ │
│                                     │  └────────────────────────┘ │
└─────────────────────────────────────┴──────────────────────────────┘
```

**Output**: CSS classes and HTML structure in `frontend/styles.css`

---

### INFRASTRUCTURE LAYER (Week 2)

#### T5: Implement Chat Storage
**Priority**: P1
**Depends on**: T1
**Effort**: Small

Extend `storage.js`:
```javascript
export function saveChatSession(bugId, session) { }
export function loadChatSession(bugId) { }
export function listChatSessions() { }
export function deleteChatSession(bugId) { }
```

Consider IndexedDB for larger storage if localStorage limits hit.

**Files**: `frontend/src/chatStorage.js` (new)

---

#### T6: Implement WebSocket Backend Endpoint
**Priority**: P1
**Depends on**: T2
**Effort**: Large

New endpoint `/api/chat/stream`:
- Upgrade HTTP to WebSocket
- Manage Claude CLI subprocess per connection
- Stream stdout to client as chunks
- Parse permission requests from Claude output
- Handle client permission responses

**Key challenge**: Claude CLI interaction mode. Options:
1. Use `claude --print` with conversation context in prompt
2. Use Claude API directly with message history
3. Investigate if `claude --resume` works programmatically

**Files**: `backend-rust/src/chat_handler.rs` (new), update `main.rs`

---

#### T7: Implement Analysis Export/Import
**Priority**: P1
**Depends on**: T3
**Effort**: Medium

```javascript
export function exportAnalysis(bugId, session) { } // Returns markdown string
export function importAnalysis(markdown) { }  // Returns session object
export function downloadAnalysis(bugId, session) { } // Triggers browser download
```

**Files**: `frontend/src/analysisIO.js` (new)

---

#### T8: Implement Chat UI Component
**Priority**: P1
**Depends on**: T1, T4
**Effort**: Large

```javascript
// In ui.js or new chatUI.js
export function renderChatPanel(bugId) { }
export function appendMessage(bugId, message) { }
export function updateStreamingMessage(bugId, chunk) { }
export function showPermissionPrompt(request) { }
export function updatePhaseIndicator(phase) { }
export function showTypingIndicator(show) { }
```

**Files**: `frontend/src/chatUI.js` (new), update `frontend/styles.css`

---

### CORE LAYER (Week 3)

#### T9: Implement Streaming Message Display
**Priority**: P1
**Depends on**: T6, T8
**Effort**: Medium

- WebSocket connection management
- Chunk buffering and display
- Markdown rendering for AI responses
- Code syntax highlighting
- Auto-scroll behavior

**Files**: `frontend/src/chatClient.js` (new)

---

#### T10: Implement Context Manager
**Priority**: P1
**Depends on**: T5, T6
**Effort**: Medium

Maintains conversation state:
- Tracks current phase
- Stores structured analysis results
- Rebuilds context for resumed sessions
- Syncs between frontend storage and backend session

**Files**: `frontend/src/chatContext.js` (new)

---

#### T11: Implement Codebase Access Configuration
**Priority**: P1
**Depends on**: T10
**Effort**: Medium

Three-tier codebase access system:

**UI Components**:
- Modal at chat session start with 3 radio options
- Path input + browse button for local repo
- Persist user preference in localStorage

**Tier Implementation**:
1. **Local**: Path validation (check for `mach` or `.gecko-dir`), send path to backend
2. **Searchfox**: Set flag `useSearchfox: true`, AI uses WebFetch for https://searchfox.org/
3. **None**: Set flag `skipCodebase: true`, display "limited mode" badge in chat

**Backend**:
- Validation endpoint for local path: `POST /api/validate-codebase`
- No backend changes needed for searchfox (frontend handles via existing WebFetch)

**Files**: Update `frontend/src/config.js`, new `frontend/src/codebaseModal.js`

---

#### T12: Implement Phase-Based Workflow
**Priority**: P1
**Depends on**: T9, T10, T11
**Effort**: Medium

Implement the 5-phase workflow from the skill:
1. **Gathering**: Display bug overview, check if closed
2. **Classification**: Detect STR, testcase, crashstack, fuzzing
3. **Assessment**: Severity/priority assignment
4. **Investigation**: Codebase search (behavior varies by tier):
   - **Local**: Full file access via backend proxy
   - **Searchfox**: WebFetch to searchfox.org API (slower, show "searching online...")
   - **None**: Skip or show "code investigation unavailable" with limited heuristics
5. **Response**: Draft using canned templates

**Phase 4 Adaptation**:
```javascript
if (codebaseMode === 'local') {
  // Use Claude with file system tools
} else if (codebaseMode === 'searchfox') {
  // Inject searchfox search results into context
  // AI can request: "search for AudioContext in dom/"
} else {
  // Show: "Skipping code investigation (no codebase access)"
  // Still provide component-based guesses from bug metadata
}
```

**Files**: `frontend/src/chatWorkflow.js` (new), `frontend/src/searchfoxClient.js` (new), `frontend/src/prompts.js` (update with phase prompts)

---

### INTERACTIVE LAYER (Week 4)

#### T13: Implement Permission Forwarding
**Priority**: P1
**Depends on**: T9, T10
**Effort**: Medium

- Parse permission requests from Claude output
- Display modal with file path and action description
- Options: Allow once, Allow for session, Deny
- Send response back through WebSocket
- Log permission decisions

**Files**: `frontend/src/permissionHandler.js` (new)

---

#### T14: Implement Codebase Proxy
**Priority**: P2
**Depends on**: T11
**Effort**: Medium

Backend file access with restrictions:
- Validate paths within codebase root
- Read-only by default
- Log all file accesses
- Optional: cache frequently accessed files

**Files**: `backend-rust/src/codebase_proxy.rs` (new)

---

#### T15: Integrate with Bug Processing UI
**Priority**: P1
**Depends on**: T12
**Effort**: Medium

- "Chat" button on each bug row
- Chat results populate existing UI fields (tags, summary, severity)
- Existing "Process" uses one-shot, "Chat" opens interactive
- Display chat icon/indicator for bugs with active sessions

**Files**: Update `frontend/src/ui.js`, `frontend/src/app.js`

---

### ADVANCED LAYER (Week 5)

#### T16: Implement Session Resume
**Priority**: P1
**Depends on**: T7, T10, T12
**Effort**: Large

- Load saved analysis file
- Reconstruct chat history
- Resume Claude conversation with context
- Detect and highlight changes since last analysis

**Files**: `frontend/src/chatResume.js` (new)

---

#### T17: Implement Analysis Diff
**Priority**: P2
**Depends on**: T7, T16
**Effort**: Medium

When resuming:
- Fetch current bug state from Bugzilla
- Compare with saved analysis
- Highlight new comments, status changes, attachments
- Suggest re-analysis of changed sections

**Files**: `frontend/src/analysisDiff.js` (new)

---

#### T18: Initial Analysis Prompts
**Priority**: P1
**Depends on**: T12
**Effort**: Medium

Port the skill's prompts to `prompts.js`:
- Phase-specific system prompts
- Bug context formatting
- Canned response integration
- Output schema for structured data

**Files**: Update `frontend/src/prompts.js`

---

### POLISH LAYER (Week 6)

#### T19: Chat History Search/Navigation
**Priority**: P3
**Effort**: Small

- Search within chat history
- Jump to specific phases
- Collapse/expand long messages

---

#### T20: E2E Testing
**Priority**: P2
**Effort**: Medium

- Mock WebSocket server for frontend tests
- Backend integration tests
- Full workflow test with real Claude (manual)

---

#### T21: Documentation
**Priority**: P2
**Effort**: Small

- Update README with chat feature
- Add troubleshooting guide
- Document analysis file format

---

## Critical Path (MVP)

```
T0 (Research) ─────────────────────────────────┐
                                               │
T1 → T5 → T10 ─────────────────────────────────┤
                                               │
T2 → T6 ───────┬─→ T9 → T12 ──┬─→ T15 (MVP)   │
               │              │                │
T4 → T8 ───────┘              │                │
                              │                │
T3 → T7 ──────────────────────┘                │
                                               │
T11 → T14 ─────────────────────────────────────┘
              │
              └─→ T13 (Permission Forwarding)
```

**MVP Scope** (Full Skill Parity):
1. **T0**: Research spike - Claude integration approach
2. **T1-T4**: Foundation - data models, protocol, format, UI design
3. **T5-T8**: Infrastructure - storage, WebSocket, export/import, chat UI
4. **T9-T12**: Core - streaming, context, codebase config, phase workflow
5. **T11, T13, T14**: Interactive - codebase proxy, permissions
6. **T15**: Integration - connect to bug processing UI

**Defer to v2**:
- T16: Session resume from saved files
- T17: Analysis diff on bug updates
- T19: Chat history search

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude CLI doesn't support conversation mode well | High | Fall back to HTTP API with history |
| WebSocket complexity in Rust backend | Medium | Use well-tested tokio-tungstenite |
| localStorage limits for long conversations | Medium | Implement compression or IndexedDB |
| Permission forwarding parsing unreliable | Medium | Use structured output mode |
| Browser CORS blocks WebSocket | Low | Already have backend proxy pattern |

---

## Suggested Implementation Order

**Sprint 0 (Research)**: T0 - Claude integration spike (BLOCKING)
**Sprint 1 (Foundation)**: T1, T2, T3, T4 in parallel
**Sprint 2 (Infrastructure)**: T5, T6, T7, T8
**Sprint 3 (Core)**: T9, T10, T11, T12
**Sprint 4 (Interactive)**: T13, T14, T15, T18
**Sprint 5 (Polish)**: T16, T17, T19, T20, T21

---

## Quick Reference: Task List

| ID | Task | Priority | Depends On | Status |
|----|------|----------|------------|--------|
| T0 | Claude Integration Research | P0 | - | ✅ DONE |
| T1 | Chat Data Models | P0 | T0 | ✅ DONE |
| T2 | Backend WebSocket Protocol | P0 | T0 | ✅ DONE |
| T3 | Analysis Persistence Format | P0 | - | ✅ DONE |
| T4 | Chat UI Mockup/Design | P0 | - | ✅ DONE |
| T5 | Chat Storage | P1 | T1 | 🔲 TODO |
| T6 | WebSocket Backend Endpoint | P1 | T0, T2 | 🔲 TODO |
| T7 | Analysis Export/Import | P1 | T3 | 🔲 TODO |
| T8 | Chat UI Component | P1 | T1, T4 | 🔲 TODO |
| T9 | Streaming Message Display | P1 | T6, T8 | 🔲 TODO |
| T10 | Context Manager | P1 | T5, T6 | 🔲 TODO |
| T11 | Codebase Path Configuration | P1 | T10 | 🔲 TODO |
| T12 | Phase-Based Workflow | P1 | T9, T10 | 🔲 TODO |
| T13 | Permission Forwarding | P1 | T9, T10 | 🔲 TODO |
| T14 | Codebase Proxy | P1 | T11 | 🔲 TODO |
| T15 | Bug UI Integration | P1 | T12 | 🔲 TODO |
| T16 | Session Resume | P2 | T7, T10, T12 | 🔲 TODO |
| T17 | Analysis Diff | P2 | T7, T16 | 🔲 TODO |
| T18 | Initial Analysis Prompts | P1 | T12 | 🔲 TODO |
| T19 | Chat History Search | P3 | T8 | 🔲 TODO |
| T20 | E2E Testing | P2 | All | 🔲 TODO |
| T21 | Documentation | P2 | All | 🔲 TODO |

---

## Files to Create/Modify

### New Files (Frontend)
- ✅ `frontend/src/chatModels.js` - Data structures (T1)
- ✅ `frontend/src/chatProtocol.js` - WebSocket protocol (T2)
- ✅ `frontend/src/analysisFormat.js` - Persistence format (T3)
- `frontend/src/chatStorage.js` - localStorage wrapper (T5)
- `frontend/src/analysisIO.js` - Export/import (T7)
- `frontend/src/chatUI.js` - UI components (T8)
- `frontend/src/chatClient.js` - WebSocket client (T9)
- `frontend/src/chatContext.js` - Context management (T10)
- `frontend/src/codebaseModal.js` - Codebase access selection UI (T11)
- `frontend/src/searchfoxClient.js` - Searchfox.org API client (T12)
- `frontend/src/chatWorkflow.js` - Phase workflow (T12)
- `frontend/src/permissionHandler.js` - Permission UI (T13)
- `frontend/src/chatResume.js` - Session resume (T16)
- `frontend/src/analysisDiff.js` - Diff logic (T17)

### New Files (Backend)
- `backend-rust/src/chat_protocol.rs` - Protocol types (T2)
- `backend-rust/src/chat_handler.rs` - WebSocket handler (T6)
- `backend-rust/src/codebase_proxy.rs` - File access (T14)

### Modified Files
- ✅ `frontend/styles.css` - Chat panel styles (T4, T8) - *T4 styles added*
- `frontend/src/config.js` - Codebase path setting (T11)
- `frontend/src/prompts.js` - Phase prompts (T18)
- `frontend/src/ui.js` - Chat button integration (T15)
- `frontend/src/app.js` - Chat orchestration (T15)
- `backend-rust/src/main.rs` - WebSocket route (T6)

### Documentation
- ✅ `docs/claude-integration-research.md` - Research findings (T0)
- ✅ `docs/ai-chat-interface-plan.md` - This plan document
- `docs/chat-protocol.md` - Protocol spec (T2) - *defined in chatProtocol.js*
- `docs/analysis-format.md` - File format spec (T3) - *defined in analysisFormat.js*

---

## Verification Plan

### TDD Verification (Every Task)

**Before implementing any task:**
```bash
# 1. Write tests first
cd frontend
# Create/update test file: src/__tests__/{module}.test.js

# 2. Run tests - they should FAIL (red)
npm test {module}
# Expected: Tests fail because implementation doesn't exist yet
```

**After implementing:**
```bash
# 3. Run tests - they should PASS (green)
npm test {module}
# Expected: All new tests pass

# 4. Run ALL tests - check for regressions
npm test
# Expected: ALL tests pass (old + new)
```

### After Each Sprint

**Sprint 0 (Research)**:
- Document clearly states which approach (CLI --resume or HTTP API)
- Proof-of-concept code demonstrates conversation continuity
- Streaming works in a simple test

**Sprint 1-2 (Foundation + Infrastructure)**:
- **All unit tests pass**: `cd frontend && npm test` (no failures)
- Backend compiles: `cd backend-rust && cargo build`
- WebSocket connects: open browser console, verify connection established
- Chat panel opens/closes and resizes correctly

**Sprint 3-4 (Core + Interactive)**:
- Start backend: `CLAUDE_BACKEND_MODE=cli cargo run`
- Start frontend: `cd frontend && python -m http.server 8000`
- Load a bug, click "Chat", verify:
  - Phase indicator updates
  - AI responses stream in

**Test all three codebase tiers**:
- **Tier 1 (Local)**: Provide Firefox repo path → permission prompts appear → files readable
- **Tier 2 (Searchfox)**: Select "Search online" → see "searching searchfox.org..." → results in chat
- **Tier 3 (None)**: Select "Skip" → see "limited mode" badge → Phase 4 shows "code investigation unavailable"

**MVP Complete**:
1. Load bug 1234567 (use a real bug you have access to)
2. Click "Chat" button
3. Verify 5-phase workflow completes:
   - Gathering: Bug overview displayed
   - Classification: STR/testcase/crashstack detected
   - Assessment: Severity/priority suggested
   - Investigation: Relevant code files identified (requires Firefox repo path)
   - Response: Draft comment generated
4. Resize chat panel - verify it remembers width
5. Export analysis to markdown file
6. Verify tags/summary populated in main UI

### Manual Test Cases

| Test | Steps | Expected |
|------|-------|----------|
| Chat opens | Click "Chat" on bug row | Drawer slides in from right |
| Resize works | Drag left edge of panel | Width changes, persists on reload |
| Streaming | Send message | AI response appears character-by-character |
| Permission (local) | AI tries to read file with local repo | Modal appears with Allow/Deny |
| Searchfox mode | Select "Search online" option | "Searching searchfox.org..." appears, results load |
| No codebase | Select "Skip code investigation" | "Limited mode" badge, Phase 4 shows reduced info |
| Export | Click "Save Analysis" | Downloads bug{ID}-analysis.md |
| Resume | Close chat, reopen | Previous messages still visible |

---

## Next Steps

1. **Start with T0** (Research Spike) - this is blocking
2. After T0, parallelize T1-T4 (Foundation layer)
3. Begin T6 (WebSocket) as soon as T0 and T2 are done

Ready to begin implementation when approved.
