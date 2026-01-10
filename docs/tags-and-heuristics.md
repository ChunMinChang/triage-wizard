# Tags, Heuristics, and Rules

This document defines each tag, how it is computed, and how the UI should use tag combinations.

---

## 1. Tag list

1. **Has STR**
2. **test-attached**
3. **fuzzy-test-attached**
4. **crashstack**
5. **AI-detected STR**
6. **AI-detected test-attached**

---

## 2. Sources of evidence

- **Bugzilla fields**: bug JSON fields (e.g. `cf_has_str`, `keywords`, `flags`, `cf_crash_signature`).
- **Attachments**: attachment metadata and file naming/content-type heuristics.
- **Text heuristics**: regex/pattern checks on description/comments.
- **AI output**: provider-agnostic booleans + notes.

All tags should store:
- `source`: one or more of `bug-field | attachment | heuristic | ai`
- `evidence`: short explanation (tooltip)

---

## 3. Tag definitions

### 3.1 Has STR

**Definition**: reflects Bugzilla’s `cf_has_str` field.

- If `cf_has_str` indicates “yes”, apply tag.
- Otherwise, do not apply.

### 3.2 test-attached (non-AI only)

**Definition**: bug includes a testcase/test file as an attachment or strong Bugzilla metadata indicator.

Set `test-attached` if any of the following are true:

1) **Bug keywords**
- `keywords` includes `testcase`.

2) **Attachments (preferred)**
- There exists at least one attachment that is:
  - not obsolete
  - not a patch
  - not private
  - and looks like a testcase:
    - filename contains: `testcase`, `repro`, `poc`, `reduced`, `min`, `minimized`
    - OR extension suggests runnable test: `.html`, `.xhtml`, `.js`, `.mjs`, `.zip`, `.txt`
    - OR content-type indicates relevant test formats (e.g. HTML/text).

3) **Test-suite flags (optional heuristic)**
- flags like `in-testsuite+` / `in-qa-testsuite` can be treated as evidence that tests exist.

**Critical rule**:
- `test-attached` **must not** be set from AI.
- Even if AI says a testcase is attached/linked, that should set **AI-detected test-attached** only.

### 3.3 AI-detected test-attached

**Definition**: AI determines that a testcase exists via:
- a URL, gist, external repo, inline snippet that functions as a testcase
- references implying a testcase not represented as a Bugzilla attachment

Set if AI returns `ai_detected_test_attached: true`.

### 3.4 fuzzy-test-attached

**Definition**: bug includes a fuzzing testcase or clearly fuzzing-derived repro.

Set if:
- strong fuzzing signals in text (e.g. “Found while fuzzing”, “fuzzilli”, “oss-fuzz”, “fuzzfetch”, “Grizzly Replay”), AND
- testcase signals exist (attachments or AI fuzzing indicator).

Sources:
- heuristics and/or AI (`fuzzing_testcase` boolean).

### 3.5 crashstack

**Definition**: crash stack trace or sanitizer trace is present.

Set if any:
- `cf_crash_signature` is non-empty.
- comment text contains stack patterns:
  - `#0`, `#1` style frames
  - “AddressSanitizer”, “UndefinedBehaviorSanitizer”, “ASan”, “UBSan”, etc.
- AI returns `crashstack_present: true`.

### 3.6 AI-detected STR

**Definition**: AI finds clear reproduction steps (STR).

Set if AI returns `ai_detected_str: true`.

AI should be conservative:
- actionable steps or commands must be present
- not merely “it sometimes happens”

---

## 4. Cross-tag rules

### 4.1 Has STR suggestion

Compute:

`hasStrSuggested = test-attached OR fuzzy-test-attached OR AI-detected STR OR AI-detected test-attached`

If `hasStrSuggested` is true **and** `Has STR` is not set:
- show “Set Has STR” suggestion
- provide one-click update action

### 4.2 Fuzzing implies test

If `fuzzy-test-attached` is true, the bug is actionable like a testcase bug.
(We still keep tags distinct for filtering.)

---

## 5. UI filter presets

Recommended presets:

1) **AI STR but no Has STR**
- Include: `AI-detected STR`
- Exclude: `Has STR`

2) **AI STR + AI test-attached but no formal STR/test tags**
- Include: `AI-detected STR`, `AI-detected test-attached`
- Exclude: `Has STR`, `test-attached`

3) **Fuzzing testcase**
- Include: `fuzzy-test-attached`

---

## 6. Notes on “best effort” heuristics

This is a POC.
- Prefer correctness and traceability (evidence tooltips).
- Keep heuristics simple and explainable.
- Allow users to rely on AI for additional signal without conflating AI tags with non-AI tags.

