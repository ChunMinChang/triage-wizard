# Canned Response Markdown Specification (v1)

This document defines the canonical Markdown format for canned responses used by this project.

## 1. Target data model

Each parsed response becomes:

```ts
interface CannedResponse {
  id: string;
  title: string;
  bodyTemplate: string;
  description?: string;
  categories?: string[];
}
```

---

## 2. File structure

- UTF‑8 text.
- Any content before the first response section is ignored.
- Each canned response section starts with a level‑2 heading:

```markdown
## <heading text>
```

- All content until the next `## ` heading or EOF belongs to that response.

---

## 3. Section structure

```markdown
## <section heading text>
[Metadata line 1]
[Metadata line 2]
...
[Blank line]
Body line 1
Body line 2
...
```

### 3.1 Metadata lines (optional)

Metadata lines appear immediately after the heading and must match:

```text
Key: value
```

Recognized keys (case-insensitive):
- `ID`
- `Title`
- `Categories`
- `Description`

Metadata ends when a line does not match the `Key: value` pattern.

### 3.2 Body

- The body is all remaining lines in the section.
- Preserve Markdown formatting.
- Trim leading/trailing completely blank lines.

---

## 4. Field derivation

### 4.1 `id`

- If `ID:` is present: use its trimmed value.
- Otherwise slugify the section heading:
  - lowercase
  - replace `[^a-z0-9]+` with `-`
  - trim leading/trailing `-`

If duplicate IDs occur:
- Recommended behavior: keep the first; suffix subsequent with `-2`, `-3`, ...

### 4.2 `title`

- If `Title:` present: use it.
- Else: use heading text.

### 4.3 `categories`

- If `Categories:` present: split by commas, trim, drop empties.

### 4.4 `description`

- If `Description:` present: store as triager-facing note.

### 4.5 `bodyTemplate`

- All body lines joined with `\n`, formatting preserved.

---

## 5. Notes

- Horizontal rules (`---`) are treated as normal body content.
- Unknown metadata keys may be ignored.

---

## 6. Example

```markdown
## need-str
Title: Ask for Steps to Reproduce
Categories: need-info, str
Description: Ask the reporter to provide a clear STR when none is present.

Hi, and thanks for filing this bug!

To investigate it, we need clear **Steps to Reproduce**:

1. ...
2. ...
```

