# Mozilla Bugzilla Triage Helper

A web app to help Mozilla developers triage Bugzilla bugs efficiently. Load bugs, analyze them with heuristics and AI, filter actionable items, and draft responses.

## Features

- **Bug Loading**: Load bugs by ID, REST URL, or `buglist.cgi` URL
- **Smart Tagging**: Automatic detection of STR, test attachments, crash stacks, and fuzzing testcases
- **AI Analysis**: Optional AI-powered classification, summaries, and response drafting (Gemini, Claude)
- **Canned Responses**: Maintain a library of response templates, customize with AI
- **Filtering**: Filter bugs by tags to surface actionable items
- **Export**: Download results as JSON, CSV, or Markdown
- **Test Page Generation**: Auto-generate HTML test pages from bug code snippets

---

## Quick Start

### Option 1: Frontend Only (Simplest)

```bash
cd frontend
python -m http.server 8000
```

Open http://localhost:8000 in your browser.

**Configure in Settings:**
- Bugzilla host: `https://bugzilla.mozilla.org` (default)
- AI provider: Select Gemini or Claude
- API key: Enter your API key for AI features
- Transport: "Browser" (direct API calls)

### Option 2: With Backend (Recommended for Claude CLI)

The backend is needed for:
- Using **Claude Code CLI** authentication (no API key needed in browser)
- Bypassing CORS restrictions
- Keeping API keys server-side

**Prerequisites:**
- [Rust](https://rustup.rs/) installed
- [Claude Code](https://claude.ai/code) installed and authenticated (`claude login`)

**Start the backend:**

```bash
cd backend-rust
CLAUDE_BACKEND_MODE=cli cargo run
```

**Start the frontend:**

```bash
cd frontend
python -m http.server 8000
```

Open http://localhost:8000 and configure:
- AI provider: Claude
- Transport: "Backend"
- Backend URL: `http://localhost:3000`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Frontend                          │    │
│  │  index.html + ES modules (no build step)            │    │
│  │                                                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │ app.js   │ │ ui.js    │ │ tags.js  │            │    │
│  │  │ (wiring) │ │ (render) │ │ (logic)  │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │bugzilla.js│ │ ai.js   │ │filters.js│            │    │
│  │  │ (API)    │ │(providers)│ │(queries) │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  └─────────────────────────────────────────────────────┘    │
│              │                      │                        │
│              │ Direct API calls     │ Backend proxy          │
│              ▼ (browser mode)       ▼ (backend mode)         │
└──────────────┼──────────────────────┼───────────────────────┘
               │                      │
               │                      ▼
               │              ┌──────────────────┐
               │              │  Backend (Rust)  │
               │              │  localhost:3000  │
               │              │                  │
               │              │  Claude CLI Mode │
               │              │  spawns: claude  │
               │              └────────┬─────────┘
               │                       │
               ▼                       ▼
        ┌─────────────┐        ┌─────────────┐
        │ Bugzilla    │        │ AI Provider │
        │ REST API    │        │ (Claude/    │
        │             │        │  Gemini)    │
        └─────────────┘        └─────────────┘
```

**Key design principles:**
- Pure vanilla JS frontend (no frameworks, no build step)
- Browser loads ES modules directly
- Backend is optional (only needed for CLI mode or CORS bypass)
- All AI prompts centralized in `frontend/src/prompts.js`

---

## User Guide

### Loading Bugs

Enter bug IDs or URLs in the input field:

| Input Type | Example |
|------------|---------|
| Bug IDs | `123456 234567` or `123456,234567` |
| REST URL | `https://bugzilla.mozilla.org/rest/bug?...` |
| Buglist URL | `https://bugzilla.mozilla.org/buglist.cgi?...` |

Click **Load** to fetch bug data.

### Processing Bugs

- **Process**: Analyze a single bug (tags + AI if configured)
- **Process All**: Analyze all loaded bugs

After processing, each bug displays:
- Computed tags (Has STR, test-attached, crashstack, etc.)
- AI-detected signals (AI-detected STR, AI-detected test-attached)
- AI summary (click "Summary" to expand)
- Suggested severity/priority
- Test page link (if AI generated one)

### Filtering Bugs

Use the filter controls to find actionable bugs:

| Preset | Description |
|--------|-------------|
| AI STR but no Has STR | Bugs where AI found STR but Bugzilla field not set |
| Needs triage | Bugs missing Has STR or test |
| Fuzzing testcase | Bugs from fuzzing tools |

### Composing Responses

1. Click **Compose** on a bug row
2. Select a canned response from the dropdown
3. Optionally select AI options (Shorter, Friendlier, +STR request)
4. Click **AI Customize** to personalize for this bug
5. Copy to clipboard or post directly to Bugzilla

### Managing Canned Responses

Canned responses are stored in `frontend/canned-responses.md` and can be managed in the UI:

**To add a response:**
1. Go to the Canned Responses tab
2. Click "New Response"
3. Fill in ID, title, categories, and body template
4. Click Save

**To edit/delete:**
- Click "Edit" or "Delete" on any response card

**To import from Markdown:**
1. Create a `.md` file following the format in `docs/canned-responses-spec.md`
2. Use the Import button to load it

**Markdown format:**
```markdown
## response-id
Title: Response Title
Categories: need-info, str
Description: When to use this response

Hi, thanks for filing this bug!

[Response body here...]
```

### Exporting Results

Click export buttons to download analysis:

| Format | Contents |
|--------|----------|
| **JSON** | Full bug data, tags, AI analysis, summaries |
| **CSV** | Flat table for spreadsheets |
| **Markdown** | Formatted table for documentation |

Exports include computed tags, AI summaries, and triage suggestions. API keys are never exported.

### Test Page Generation

When AI is enabled and a bug contains code snippets but no test file:
- AI automatically generates a minimal HTML test page
- Click **Open Test** to preview in a new tab
- Click **⬇** to download as `bug{ID}.html`

---

## Configuration

### AI Providers

| Provider | Browser Mode | Backend Mode | Notes |
|----------|--------------|--------------|-------|
| Gemini | Yes | Yes | Recommended for browser mode |
| Claude | Yes | Yes (CLI) | Backend CLI mode recommended |
| OpenAI | No | Yes | Backend only |

### Backend Environment Variables

Create `backend-rust/.env`:

```bash
# Claude CLI mode (recommended)
CLAUDE_BACKEND_MODE=cli

# Or API mode with keys
CLAUDE_BACKEND_MODE=api
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...

# Optional: Bugzilla API key for write operations
BUGZILLA_API_KEY=...
```

### Installing Claude Code CLI

For backend CLI mode:

1. Install Claude Code: https://claude.ai/code
2. Authenticate: `claude login`
3. Verify: `claude --version`

---

## Development

### Running Tests

```bash
cd frontend
npm install   # First time only
npm test      # Run Vitest tests
```

### Project Structure

```
triage-wizard/
├── frontend/
│   ├── index.html          # Entry point
│   ├── styles.css          # All styling
│   ├── canned-responses.md # Default responses
│   └── src/
│       ├── app.js          # Orchestration
│       ├── ui.js           # DOM rendering
│       ├── bugzilla.js     # Bugzilla API
│       ├── ai.js           # AI providers
│       ├── prompts.js      # AI prompts/schemas
│       ├── tags.js         # Tag computation
│       ├── filters.js      # Filter logic
│       └── ...
├── backend-rust/
│   ├── src/main.rs         # Server + endpoints
│   └── src/claude_cli.rs   # Claude CLI integration
└── docs/
    └── canned-responses-spec.md
```

See `CLAUDE.md` files in each directory for development guidance.

---

## Security Notes

**Frontend-only mode:**
- API keys stored in browser localStorage
- Keys visible to browser extensions
- Use keys with restricted quotas

**Backend mode:**
- Keys stay server-side
- Claude CLI uses local auth
- Recommended for team use

---

## Roadmap / Future Ideas

### Needinfo Queue Import
Import bugs from a user's needinfo queue directly, making it easier to process bugs awaiting your response.

### AI Chat Interface
Add a chatbox for direct conversation with AI about the current bug or triage decisions. Useful for asking follow-up questions or getting clarification on AI suggestions.

### Oracle Map
Build a knowledge base from historical bug data to provide context-aware suggestions. When triaging a new bug, the system could surface similar past bugs, their resolutions, and patterns. Requires a database backend to store and index historical bug information.

### Cluster Detective
Large-scale bug analysis to identify patterns, duplicates, and related issues across the bug database. Would perform batch analysis and store results for quick lookup. Requires database infrastructure for storing analysis results and enabling efficient queries across large bug sets.

---

## License

MIT
