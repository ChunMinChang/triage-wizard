# Claude Code Instructions (Backend)

The backend is **optional** and exists to:
- Proxy AI calls when browser CORS blocks direct requests
- Enable **Claude Code CLI** mode for AI calls (recommended)
- Proxy Bugzilla writes when browser CORS blocks
- Keep API keys server-side (more secure than browser localStorage)

## Run

```bash
cd backend-rust
cargo run
```

Or with CLI mode explicitly:
```bash
CLAUDE_BACKEND_MODE=cli cargo run
```

## Environment variables

Create `.env` file or set environment variables:

```bash
# Claude CLI mode (only supported mode currently)
CLAUDE_BACKEND_MODE=cli

# Optional: Bugzilla API key for write operations
BUGZILLA_API_KEY=...
```

> **Note:** HTTP API mode (`CLAUDE_BACKEND_MODE=api`) is not yet implemented. The infrastructure exists but API calls return "not yet implemented" errors. Use CLI mode or browser-direct mode instead.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/classify` | Bug classification + summary |
| `POST /api/ai/suggest-response` | Suggest canned response |
| `POST /api/ai/generate` | Generate triage response |
| `POST /api/ai/refine` | Refine response with instructions |
| `POST /api/ai/testpage` | Generate test page from bug |
| `POST /api/bugzilla/set-has-str` | Set cf_has_str field |
| `POST /api/bugzilla/post-comment` | Post comment to bug |
| `GET /health` | Health check |

## Architecture

### Prompt handling
**Important**: All AI prompts are defined in `frontend/src/prompts.js`.

The frontend sends pre-built prompts and schemas to the backend:
```json
{
  "provider": "claude",
  "model": "claude-sonnet-4-20250514",
  "bug": { ... },
  "prompt": "You are a Mozilla bug triager...",
  "schema": "{\"type\":\"object\",...}"
}
```

The backend does NOT contain prompt logic - it just passes the prompt to Claude CLI or API.

### CLI mode flow
1. Frontend calls `/api/ai/classify` with prompt and schema
2. Backend spawns: `claude -p --output-format json --json-schema '<schema>' --model <model>`
3. Backend writes prompt to stdin
4. Backend reads stdout, extracts `structured_output` from JSON
5. Backend returns structured output to frontend

### Key files
- `src/main.rs` - Axum server, routes, request/response types
- `src/claude_cli.rs` - Claude Code CLI integration

## Claude Code CLI requirements

For CLI mode to work:
1. Claude Code must be installed: https://claude.ai/code
2. Claude Code must be authenticated: `claude login`
3. Verify with: `claude --version`

The CLI uses your existing Claude Code authentication - no API key needed.

## Static file serving

The backend can serve the frontend:
- Static files from `../frontend/` are served at root
- Cache-Control headers prevent browser caching during development

## CORS

CORS is configured to allow:
- `http://localhost:8000` (frontend dev server)
- `http://localhost:3000` (backend itself)
