# Claude Code Instructions (Backend)

The backend is optional and exists to:
- proxy AI calls when browser CORS blocks
- proxy Bugzilla writes when browser CORS blocks
- enable Claude Code CLI mode for AI calls

## Run

```bash
cd backend-rust
cargo run
```

## Environment variables

AI provider keys (when using HTTP API mode):
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `GROK_API_KEY` (optional)

Claude routing:
- `CLAUDE_BACKEND_MODE=api|cli`
  - `api`: call Anthropic HTTP API
  - `cli`: spawn Claude Code CLI `claude`

Bugzilla:
- Optionally `BUGZILLA_API_KEY` if you decide server-side key usage.

## Endpoints (suggested)

- `POST /api/ai/classify`
- `POST /api/ai/customize-response`
- `POST /api/ai/suggest-response`
- `POST /api/bugzilla/set-has-str`
- `POST /api/bugzilla/post-comment`

## CLI mode notes

In `CLAUDE_BACKEND_MODE=cli`:
- backend spawns `claude -p --output-format json --json-schema '<schema>' --model <model>`
- reads stdout JSON, extracts `structured_output`
- returns normalized JSON to frontend

Ensure `claude` is installed and authenticated on the machine running the backend.

