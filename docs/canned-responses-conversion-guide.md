# Guideline: Convert My Canned Responses into the Project Canned Response Markdown Format (v1)

You are given:
1) This guideline file.
2) A separate document that contains my existing canned responses (in any format).

Your task:
- Convert my existing canned responses into **one single Markdown file** that strictly follows the project format.
- Output only the final Markdown file. No explanations.

---

## Output format requirements

- Each canned response MUST be a section starting with:

```markdown
## <heading>
```

- Immediately after the heading, you MAY include metadata lines:

```text
ID: ...
Title: ...
Categories: ...
Description: ...
```

- After metadata, include the response text as Markdown body.

---

## Mapping rules

For each canned response in my original document:

### 1) Determine `ID`

- If the original has a stable identifier (key, label, name), use it:

```text
ID: <stable-id>
```

- Otherwise generate a slug from the response title:
  - lowercase
  - replace `[^a-z0-9]+` with `-`
  - trim leading/trailing `-`

### 2) Determine `Title`

- Use the original title if available.
- Otherwise create a short title describing the purpose.

### 3) Add `Categories` (recommended)

Choose 1–3 category keywords, comma-separated. Examples:
- `need-info`
- `str`
- `crash`
- `about-support`
- `nightly`
- `fuzzing`
- `performance`

### 4) Add `Description` (optional)

If the original includes triager-only guidance (“use when…”), convert it to:

```text
Description: ...
```

### 5) Body

- Copy the actual reporter-facing response text into the body.
- Preserve meaning.
- Preserve or improve formatting using Markdown lists/code.
- Do not add speculative claims or promises.

---

## Example output shape

```markdown
## need-str
ID: need-str
Title: Ask for Steps to Reproduce
Categories: need-info, str
Description: Use when the report lacks actionable STR.

Hi, thanks for filing this bug!

To investigate, we need clear steps...

## need-crash-logs
ID: need-crash-logs
Title: Ask for Crash Logs
Categories: need-info, crash

Thanks for reporting this crash...
```

Again: output **only** the final canned responses Markdown file.

