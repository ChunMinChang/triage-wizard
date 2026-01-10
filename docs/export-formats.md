# Export & Import Formats

This project supports exporting triage results as:
- JSON (primary, lossless)
- CSV
- Markdown

It also supports importing previously exported JSON to restore a session.

---

## 1. JSON export (v1)

### 1.1 Top-level structure

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-08T00:00:00Z",
  "bugzillaHost": "https://bugzilla.mozilla.org",
  "input": {
    "bugIds": ["123", "456"],
    "searchUrl": "https://bugzilla.mozilla.org/rest/bug?..."
  },
  "ai": {
    "provider": "gemini",
    "model": "...",
    "transport": "browser"
  },
  "bugs": [
    {
      "id": 123,
      "url": "https://bugzilla.mozilla.org/show_bug.cgi?id=123",
      "bugzilla": {
        "summary": "...",
        "status": "NEW",
        "product": "Core",
        "component": "Audio/Video",
        "severity": "--",
        "keywords": ["testcase"],
        "cf_has_str": "---",
        "cf_crash_signature": ""
      },
      "analysis": {
        "tags": [
          {
            "tag": "test-attached",
            "source": ["attachment"],
            "evidence": "Attachment testcase.html"
          },
          {
            "tag": "AI-detected STR",
            "source": ["ai"],
            "evidence": "AI found explicit repro steps"
          }
        ],
        "hasStrSuggested": true,
        "summary": "1–3 sentence brief summary",
        "ai": {
          "raw": { }
        }
      }
    }
  ]
}
```

### 1.2 Notes
- `analysis.summary` is the AI brief summary.
- `analysis.ai.raw` is optional and may be omitted or truncated.
- Secrets (API keys) are never included.

### 1.3 Import behavior
- Import loads `bugs[]` entries and renders them.
- If the user later re-processes a bug, new analysis can overwrite existing analysis.

---

## 2. CSV export

A single flat table.

Recommended columns:
- `bug_id`
- `bug_url`
- `summary_bugzilla`
- `status`
- `product`
- `component`
- `severity`
- `cf_has_str`
- `has_str_suggested`
- `tags` (semicolon-separated)
- `summary_ai`

Optionally add boolean columns per tag:
- `tag_has_str`
- `tag_test_attached`
- `tag_fuzzy_test_attached`
- `tag_crashstack`
- `tag_ai_detected_str`
- `tag_ai_detected_test_attached`

---

## 3. Markdown export

### 3.1 Table format

```markdown
| Bug | Status | Component | Tags | Summary (AI) |
| --- | ------ | --------- | ---- | ------------ |
| [123](https://bugzilla.mozilla.org/show_bug.cgi?id=123) | NEW | Audio/Video | test-attached; AI-detected STR | Brief summary... |
```

### 3.2 Optional appendix
For long summaries, optionally include a “Bug summaries” section below the table.

---

## 4. Consistency requirements

- The set of tags in exports must exactly match what is shown in UI.
- The AI summary shown in UI must be the same one exported.
- Importing JSON must restore:
  - tags
  - `hasStrSuggested`
  - brief summary
  - minimal Bugzilla display fields

