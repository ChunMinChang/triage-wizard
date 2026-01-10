# AI Providers & Routing (POC)

This project supports multiple AI providers with two transport modes:

- **Browser mode**: frontend calls provider directly with BYOK.
- **Backend mode**: frontend calls local Rust proxy; proxy calls provider.

Gemini and Claude are prioritized because the target audience is likely to have Gemini and Claude access.

---

## 1. Supported AI tasks

All providers may be used for these tasks:

1) **Bug classification**
- Output booleans for AI tags
- Output brief bug summary

2) **Canned response customization**
- Given a chosen canned response template, produce a customized draft

3) **Canned response suggestion**
- Given a list of canned responses, pick the best one(s) and draft a reply

Each task has a strict JSON output schema (provider-agnostic) so the UI is consistent.

---

## 2. Provider matrix

### 2.1 Gemini (preferred)

**Default**: browser mode (client-first)

- User supplies Gemini API key.
- Frontend calls Gemini REST endpoints directly.
- If CORS or policy issues occur, user can switch Gemini transport to backend proxy.

### 2.2 Claude (preferred)

Supports both:

- **Browser mode (POC)**:
  - User supplies Anthropic API key.
  - Frontend calls Anthropic Messages API directly.
  - Include the special header for direct browser use.

- **Backend mode (recommended)**:
  - Backend reads `ANTHROPIC_API_KEY` from environment.
  - Frontend never sees the key.

- **Backend CLI mode (recommended for Claude Code users)**:
  - Backend uses Claude Code CLI (`claude`) to run prompts.
  - Claude Code CLI uses existing local auth (API key env var, OAuth token, or `claude login` state).

### 2.3 OpenAI (supported)

**Default**: backend mode recommended.

- Browser mode may fail due to CORS.
- Backend reads `OPENAI_API_KEY`.

### 2.4 Grok (supported)

**Default**: backend mode recommended.

### 2.5 Custom / OpenAI-compatible endpoints

- User supplies base URL + model.
- Transport can be browser or backend.

---

## 3. Transport selection UX

Per-provider settings in UI:

- Provider: Gemini / Claude / OpenAI / Grok / Custom
- Model name
- Transport:
  - “Use in browser (BYOK)”
  - “Use backend proxy”
- API key input shown only for browser mode
- “Remember key” (localStorage) is opt-in

---

## 4. Claude Code CLI routing (backend)

### 4.1 Why CLI mode
Many target users already use Claude Code daily. CLI mode:
- avoids pasting keys into the browser
- leverages existing Claude Code authentication
- provides structured JSON output via a schema

### 4.2 Configuration
Backend env var:

- `CLAUDE_BACKEND_MODE=cli` (use Claude Code CLI)
- `CLAUDE_BACKEND_MODE=api` (use Anthropic HTTP API)

### 4.3 Request flow
Frontend → Backend:

- `POST /api/ai/classify` (or other AI task)
- JSON body includes:
  - provider=`claude`
  - model
  - task type
  - payload (bug data or canned responses)

Backend:
- Builds a prompt
- Defines a JSON schema for the required output
- Spawns:
  - `claude -p --output-format json --json-schema '<schema>' --model <model>`
- Reads stdout JSON, extracts `structured_output`
- Returns it to frontend

### 4.4 Output guarantees
The backend treats any CLI non-zero exit code as error.
The schema is required so the response is machine-parsable and stable.

---

## 5. Provider-agnostic AI output schemas

### 5.1 Bug classification schema
Required fields:
- `ai_detected_str` (bool)
- `ai_detected_test_attached` (bool)
- `crashstack_present` (bool)
- `fuzzing_testcase` (bool)
- `summary` (string, 1–3 sentences)
Optional:
- `notes` (object of short strings)

### 5.2 Customize canned response schema
- `final_response` (string)
- `used_canned_id` (string)
Optional:
- `notes`

### 5.3 Suggest canned response schema
- `selected_responses` (array of { id, reason?, customized_text })
Optional:
- `fallback_custom_text`

---

## 6. Prompting guidelines

- Always request **JSON only** output.
- Remind the model:
  - Be conservative on AI-detected STR and test-attached signals.
  - Avoid speculation.
  - Keep the summary brief.
  - Keep responses polite and actionable.

---

## 7. Failure modes and fallback

- If AI not configured:
  - Disable AI buttons; heuristics-only mode remains usable.

- If browser mode hits CORS:
  - Show the error clearly.
  - Suggest switching provider transport to backend.

- If backend/CLI mode fails:
  - Surface stderr in a safe, truncated form.
  - Suggest switching to provider API mode or browser mode.

