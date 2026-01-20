# Claude Code Instructions (Frontend)

## Stack
- Pure HTML/CSS/JS
- ES modules (no build step)
- No frameworks

## Entry point
- `index.html` loads `src/app.js` as ES module

## Module map

### Core modules
- `src/app.js` - Orchestration, event handlers, bug processing workflow
- `src/ui.js` - DOM rendering, table, modals, toasts, response composer
- `src/bugzilla.js` - Bugzilla REST API, buglist.cgi parsing
- `src/ai.js` - AI provider abstraction (Gemini, Claude), API calls
- `src/prompts.js` - **All AI prompts and schemas (centralized)**
- `src/tags.js` - Tag computation, evidence tracking, semantic rules
- `src/filters.js` - Tag filters, difference filters, presets

### Support modules
- `src/config.js` - Settings management, localStorage config
- `src/storage.js` - localStorage wrapper with namespacing
- `src/cannedResponses.js` - Canned response library, Markdown import
- `src/exports.js` - JSON/CSV/Markdown export
- `src/aiLogger.js` - AI interaction logging for debugging

## Key architectural decisions

### AI prompts centralized
All AI prompts and JSON schemas are in `src/prompts.js`:
- `SCHEMAS` object contains all output schemas
- `buildClassifyPrompt()`, `buildGeneratePrompt()`, etc. build prompts
- Used by both browser mode (direct API) and backend mode (passed to backend)

### Tag semantics
- `test-attached` - Set only by heuristics (attachment analysis)
- `AI-detected test-attached` - Set only by AI
- Never conflate these tags

### Response composer flow
1. User selects canned response
2. User optionally selects AI options (chips: Shorter, Friendlier, +STR)
3. User clicks "AI Customize" - combines base customization with selected options
4. Response is refined in one AI call

### Test page generation
- Triggered automatically during bug processing (if AI enabled, no test attached)
- Generated HTML stored as blob URL on bug object
- UI shows "Open Test" link and download button if generated

## File locations

| Purpose | File |
|---------|------|
| Bug loading | `src/bugzilla.js` |
| AI provider routing | `src/ai.js` |
| AI prompts/schemas | `src/prompts.js` |
| Tag rules | `src/tags.js` |
| Filter logic | `src/filters.js` |
| Table rendering | `src/ui.js` |
| Response composer | `src/ui.js` |
| Canned responses | `src/cannedResponses.js` |
| Export formats | `src/exports.js` |
| Settings | `src/config.js` |

## Frontend rules

- Never put API keys into exports
- Do not conflate AI tags with non-AI tags
- Keep UI accessible (aria-expanded on toggles)
- Canned responses must follow `docs/canned-responses-spec.md`

## Testing

```bash
npm install   # First time only
npm test      # Run Vitest tests
```

Tests are in `src/__tests__/` directory.
