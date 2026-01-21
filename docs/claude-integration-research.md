# Claude Integration Research - T0 Findings

## Summary

**Recommendation: Use Claude CLI mode** with `--resume` for conversation continuity and `--output-format stream-json` for real-time streaming.

This approach provides:
- Native conversation memory via session IDs
- Real-time streaming of text chunks
- File system access for codebase investigation
- Built-in permission handling

## Tested Capabilities

### 1. Conversation Resumption

**Works perfectly.** Sessions are identified by UUID and can be resumed:

```bash
# First message - capture session_id
RESULT=$(echo "Remember the number 42" | claude -p --output-format json)
SESSION_ID=$(echo "$RESULT" | jq -r '.session_id')
# Returns: "32a977e2-03d5-42d8-8bc5-f2b5b5ef9b4b"

# Resume and ask follow-up
echo "What number did I tell you to remember?" | claude -p --resume "$SESSION_ID" --output-format json | jq -r '.result'
# Returns: "42"
```

**Key flags:**
- `--resume <session-id>` - Resume specific session
- `--continue` - Resume most recent session in current directory
- `--fork-session` - Create branch from existing session
- `--session-id <uuid>` - Use specific UUID for new session

### 2. Streaming Output

**Works with `--verbose` flag.** Real-time text chunks via stream-json:

```bash
claude -p --output-format stream-json --verbose --include-partial-messages "Write a poem"
```

**Event types in stream-json:**

| Type | Subtype | Description |
|------|---------|-------------|
| `system` | `init` | Session info, tools, model |
| `stream_event` | `message_start` | AI response beginning |
| `stream_event` | `content_block_delta` | **Text chunks as they arrive** |
| `stream_event` | `content_block_stop` | Content block complete |
| `stream_event` | `message_delta` | Token counts, stop reason |
| `stream_event` | `message_stop` | Message complete |
| `assistant` | - | Full message with all content |
| `result` | `success` | Final result with cost, session_id |

**Text chunk format:**
```json
{
  "type": "stream_event",
  "event": {
    "type": "content_block_delta",
    "index": 0,
    "delta": {
      "type": "text_delta",
      "text": "Code"
    }
  },
  "session_id": "75d56498-5fd5-451d-9a99-c72aaee24010"
}
```

### 3. JSON Schema Validation

**Supports structured output:**

```bash
claude -p --output-format json --json-schema '{"type":"object","properties":{"severity":{"type":"string"},"summary":{"type":"string"}}}'
```

Returns `structured_output` field with validated JSON.

### 4. Working Directory / Codebase Access

**Claude runs in the specified working directory:**

```bash
cd /path/to/firefox-repo
claude -p "What files are in dom/media?"
# Claude can use its file tools to read the codebase
```

For our backend:
- Start Claude CLI subprocess in user's Firefox repo directory
- Claude has native file access tools (Read, Glob, Grep)
- Permission requests are emitted in the stream

## Backend Implementation Approach

### WebSocket Handler Flow

```
Browser                     Backend                      Claude CLI
   │                           │                              │
   │ WS: {type:'start',        │                              │
   │      bugId, codebasePath} │                              │
   │ ─────────────────────────>│                              │
   │                           │  spawn claude -p             │
   │                           │  --output-format stream-json │
   │                           │  --verbose                   │
   │                           │  --include-partial-messages  │
   │                           │  (in codebasePath dir)       │
   │                           │ ────────────────────────────>│
   │                           │                              │
   │                           │  write prompt to stdin       │
   │                           │ ────────────────────────────>│
   │                           │                              │
   │                           │  stream_event (chunks)       │
   │                           │ <────────────────────────────│
   │ WS: {type:'chunk',        │                              │
   │      content:'...'}       │                              │
   │ <─────────────────────────│                              │
   │                           │                              │
   │                           │  result (with session_id)    │
   │                           │ <────────────────────────────│
   │                           │                              │
   │                           │  (store session_id for       │
   │                           │   future --resume calls)     │
   │                           │                              │
   │ WS: {type:'message',      │                              │
   │      content:'follow-up'} │                              │
   │ ─────────────────────────>│                              │
   │                           │  claude -p --resume $ID      │
   │                           │ ────────────────────────────>│
   │                           │        ...                   │
```

### Session Storage (Backend)

```rust
// Per-connection state
struct ChatSession {
    bug_id: u32,
    claude_session_id: Option<String>,  // Captured from first result
    codebase_path: Option<String>,
    codebase_mode: CodebaseMode,        // Local | Searchfox | None
}

enum CodebaseMode {
    Local(PathBuf),
    Searchfox,
    None,
}
```

### Spawning Claude CLI

```rust
use tokio::process::Command;

async fn spawn_claude(
    session: &ChatSession,
    prompt: &str,
) -> Result<Child> {
    let mut cmd = Command::new("claude");
    cmd.arg("-p")
       .arg("--output-format").arg("stream-json")
       .arg("--verbose")
       .arg("--include-partial-messages");

    // Resume if we have a session ID
    if let Some(ref id) = session.claude_session_id {
        cmd.arg("--resume").arg(id);
    }

    // Set working directory for codebase access
    if let CodebaseMode::Local(ref path) = session.codebase_mode {
        cmd.current_dir(path);
    }

    cmd.stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::null())
       .spawn()
}
```

## Comparison: CLI vs HTTP API

| Feature | Claude CLI | HTTP API |
|---------|-----------|----------|
| Conversation memory | Built-in via `--resume` | Manual message history |
| Streaming | Native stream-json | Native SSE |
| File system access | Native (Read, Glob, Grep) | Requires MCP server |
| Permission handling | Native (emits permission requests) | N/A |
| Auth | Local login (`claude login`) | API key required |
| Implementation | Subprocess management | HTTP client |
| Reliability | Process lifecycle | Connection lifecycle |

**CLI wins for our use case** because:
1. Native file system tools for codebase investigation
2. Built-in conversation memory (no need to replay messages)
3. No API key management (uses local auth)
4. Permission requests are already structured

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Process crashes | Detect exit, offer retry with `--resume` |
| Long responses timeout | Use `--max-budget-usd` or streaming timeout |
| Permission prompts in output | Parse `permission_request` events from stream |
| stderr noise | Redirect stderr, only parse stdout |

## Recommended CLI Command Template

```bash
claude -p \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --model sonnet \
  [--resume $SESSION_ID] \
  [--json-schema '$SCHEMA'] \
  "$PROMPT"
```

## Next Steps

1. **T2**: Define WebSocket protocol using these event types
2. **T6**: Implement Rust subprocess management with:
   - stdout line-by-line parsing for JSONL
   - Session ID extraction from `result` events
   - Text chunk forwarding from `content_block_delta` events
3. **T13**: Permission handling from `permission_request` events (TBD - need to test with actual file access)

---

*Research completed: 2026-01-21*
