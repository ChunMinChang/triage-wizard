/**
 * @fileoverview Tag computation and semantic rules module.
 *
 * Responsibilities:
 * - Compute heuristic tags from bug data
 * - Merge AI tags with heuristic tags
 * - Enforce semantic rules (test-attached is non-AI only)
 * - Calculate hasStrSuggested flag
 *
 * Tags:
 * - "Has STR" - from cf_has_str field
 * - "test-attached" - from metadata/attachments (NON-AI ONLY)
 * - "fuzzy-test-attached" - fuzzing testcase signals
 * - "crashstack" - crash/sanitizer traces
 * - "AI-detected STR" - AI finds clear repro steps (AI ONLY)
 * - "AI-detected test-attached" - AI finds testcase referenced (AI ONLY)
 *
 * @module tags
 */

/** Tag IDs */
export const TAG_IDS = {
  HAS_STR: 'has-str',
  TEST_ATTACHED: 'test-attached',
  FUZZY_TEST_ATTACHED: 'fuzzy-test-attached',
  CRASHSTACK: 'crashstack',
  AI_DETECTED_STR: 'ai-detected-str',
  AI_DETECTED_TEST_ATTACHED: 'ai-detected-test-attached',
};

/** Tag labels for display */
const TAG_LABELS = {
  [TAG_IDS.HAS_STR]: 'Has STR',
  [TAG_IDS.TEST_ATTACHED]: 'test-attached',
  [TAG_IDS.FUZZY_TEST_ATTACHED]: 'fuzzy-test-attached',
  [TAG_IDS.CRASHSTACK]: 'crashstack',
  [TAG_IDS.AI_DETECTED_STR]: 'AI-detected STR',
  [TAG_IDS.AI_DETECTED_TEST_ATTACHED]: 'AI-detected test-attached',
};

/** Tags that can ONLY be set by AI */
export const AI_ONLY_TAGS = [
  TAG_IDS.AI_DETECTED_STR,
  TAG_IDS.AI_DETECTED_TEST_ATTACHED,
];

/** Tags that can NEVER be set by AI */
export const NON_AI_TAGS = [
  TAG_IDS.TEST_ATTACHED,
];

/** File extensions that suggest a testcase attachment */
const TESTCASE_EXTENSIONS = ['.html', '.xhtml', '.js', '.mjs', '.zip', '.txt'];

/** Filename patterns that suggest a testcase attachment */
const TESTCASE_FILENAME_PATTERNS = [
  /testcase/i,
  /repro/i,
  /poc/i,
  /reduced/i,
  /\bmin[_-]?/i,
  /minimized/i,
];

/** Fuzzing signal patterns */
const FUZZING_PATTERNS = [
  /found while fuzzing/i,
  /fuzzilli/i,
  /oss-fuzz/i,
  /fuzzfetch/i,
  /grizzly replay/i,
];

/** Crash stack patterns */
const CRASHSTACK_PATTERNS = [
  /#[0-9]\s+0x[0-9a-fA-F]+/,  // Stack frame like "#0 0x12345"
  /AddressSanitizer/i,
  /\bASan\b/,
  /UndefinedBehaviorSanitizer/i,
  /\bUBSan\b/,
  /ThreadSanitizer/i,
  /\bTSan\b/,
  /MemorySanitizer/i,
  /\bMSan\b/,
];

/**
 * Create a tag object.
 * @param {string} id - Tag ID
 * @param {string[]} source - Sources of evidence
 * @param {string} evidence - Evidence explanation
 * @returns {Object} Tag object
 */
function createTag(id, source, evidence) {
  return {
    id,
    label: TAG_LABELS[id] || id,
    source,
    evidence,
  };
}

/**
 * Check if bug has "Has STR" tag.
 * @param {Object} bug - Bug object
 * @returns {Object|null} Tag object or null
 */
export function checkHasStr(bug) {
  if (!bug) return null;

  const cfHasStr = bug.cf_has_str || bug.cfHasStr;

  if (cfHasStr === 'yes') {
    return createTag(TAG_IDS.HAS_STR, ['bug-field'], `cf_has_str = "${cfHasStr}"`);
  }

  return null;
}

/**
 * Check if bug has "test-attached" tag.
 * @param {Object} bug - Bug object
 * @returns {Object|null} Tag object or null
 */
export function checkTestAttached(bug) {
  if (!bug) return null;

  // Check keywords
  const keywords = bug.keywords;
  if (keywords) {
    // Handle array or comma-separated string
    const keywordList = Array.isArray(keywords)
      ? keywords
      : String(keywords).split(',').map((k) => k.trim());

    // Check for exact "testcase" keyword (not partial matches)
    if (keywordList.some((k) => k.toLowerCase() === 'testcase')) {
      return createTag(TAG_IDS.TEST_ATTACHED, ['bug-field'], 'Keyword: testcase');
    }
  }

  // Check attachments
  const attachments = bug.attachments;
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      // Skip obsolete, patch, or private attachments
      if (att.is_obsolete || att.is_patch || att.is_private) {
        continue;
      }

      const filename = (att.file_name || att.filename || '').toLowerCase();

      // Check filename patterns
      for (const pattern of TESTCASE_FILENAME_PATTERNS) {
        if (pattern.test(filename)) {
          return createTag(
            TAG_IDS.TEST_ATTACHED,
            ['attachment'],
            `Attachment: ${att.file_name} (filename matches testcase pattern)`
          );
        }
      }

      // Check file extension
      for (const ext of TESTCASE_EXTENSIONS) {
        if (filename.endsWith(ext)) {
          return createTag(
            TAG_IDS.TEST_ATTACHED,
            ['attachment'],
            `Attachment: ${att.file_name} (${ext} file)`
          );
        }
      }
    }
  }

  // Check flags
  const flags = bug.flags;
  if (flags && Array.isArray(flags)) {
    for (const flag of flags) {
      const flagName = flag.name || '';
      const flagStatus = flag.status || '';

      if (
        (flagName === 'in-testsuite' || flagName === 'in-qa-testsuite') &&
        flagStatus === '+'
      ) {
        return createTag(
          TAG_IDS.TEST_ATTACHED,
          ['bug-field'],
          `Flag: ${flagName}${flagStatus}`
        );
      }
    }
  }

  return null;
}

/**
 * Check if bug has "fuzzy-test-attached" tag.
 * @param {Object} bug - Bug object
 * @returns {Object|null} Tag object or null
 */
export function checkFuzzyTestAttached(bug) {
  if (!bug) return null;

  // Collect all text to search
  const texts = [];

  // Add description
  if (bug.description) {
    texts.push(bug.description);
  }

  // Add comments
  const comments = bug.comments;
  if (comments && Array.isArray(comments)) {
    for (const comment of comments) {
      if (comment.text) {
        texts.push(comment.text);
      }
    }
  }

  // Check for fuzzing patterns
  const combinedText = texts.join('\n');
  for (const pattern of FUZZING_PATTERNS) {
    const match = combinedText.match(pattern);
    if (match) {
      return createTag(
        TAG_IDS.FUZZY_TEST_ATTACHED,
        ['heuristic'],
        `Text contains fuzzing signal: "${match[0]}"`
      );
    }
  }

  return null;
}

/**
 * Check if bug has "crashstack" tag.
 * @param {Object} bug - Bug object
 * @returns {Object|null} Tag object or null
 */
export function checkCrashstack(bug) {
  if (!bug) return null;

  // Check cf_crash_signature
  const crashSig = bug.cf_crash_signature || bug.cfCrashSignature;
  if (crashSig && crashSig.trim()) {
    return createTag(
      TAG_IDS.CRASHSTACK,
      ['bug-field'],
      `Crash signature: ${crashSig.substring(0, 50)}${crashSig.length > 50 ? '...' : ''}`
    );
  }

  // Check comments for stack patterns
  const comments = bug.comments;
  if (comments && Array.isArray(comments)) {
    for (const comment of comments) {
      const text = comment.text || '';
      for (const pattern of CRASHSTACK_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          return createTag(
            TAG_IDS.CRASHSTACK,
            ['heuristic'],
            `Stack trace pattern found: "${match[0]}"`
          );
        }
      }
    }
  }

  return null;
}

/**
 * Compute heuristic tags for a bug.
 * @param {Object} bug - Bug object with metadata, attachments, comments
 * @returns {Object[]} Array of tag objects { id, label, source[], evidence }
 */
export function computeHeuristicTags(bug) {
  if (!bug) return [];

  const tags = [];

  // Check each tag type
  const hasStrTag = checkHasStr(bug);
  if (hasStrTag) tags.push(hasStrTag);

  const testAttachedTag = checkTestAttached(bug);
  if (testAttachedTag) tags.push(testAttachedTag);

  const fuzzyTag = checkFuzzyTestAttached(bug);
  if (fuzzyTag) tags.push(fuzzyTag);

  const crashTag = checkCrashstack(bug);
  if (crashTag) tags.push(crashTag);

  return tags;
}

/**
 * Merge AI tags with existing tags.
 * Enforces semantic rule: AI never sets test-attached.
 * @param {Object[]} existingTags - Current tags
 * @param {Object} aiResult - AI classification result
 * @returns {Object[]} Merged tags
 */
export function mergeAiTags(existingTags, aiResult) {
  if (!aiResult) return existingTags;

  const merged = [...existingTags];
  const existingIds = new Set(existingTags.map((t) => t.id));

  // Add AI-detected STR
  if (aiResult.ai_detected_str && !existingIds.has(TAG_IDS.AI_DETECTED_STR)) {
    merged.push(
      createTag(
        TAG_IDS.AI_DETECTED_STR,
        ['ai'],
        aiResult.ai_evidence || 'AI detected reproduction steps'
      )
    );
  }

  // Add AI-detected test-attached
  if (
    aiResult.ai_detected_test_attached &&
    !existingIds.has(TAG_IDS.AI_DETECTED_TEST_ATTACHED)
  ) {
    merged.push(
      createTag(
        TAG_IDS.AI_DETECTED_TEST_ATTACHED,
        ['ai'],
        aiResult.ai_evidence || 'AI detected testcase reference'
      )
    );
  }

  // CRITICAL: Never add test-attached from AI (enforces NON_AI_TAGS rule)
  // Even if AI says test_attached: true, we ignore it

  return merged;
}

/**
 * Calculate whether to suggest setting Has STR.
 * Formula:
 *   hasStrSuggested = (test-attached OR fuzzy-test-attached OR
 *                      AI-detected STR OR AI-detected test-attached) AND NOT Has STR
 *
 * @param {Object[]} tags - Array of tag objects
 * @returns {boolean} True if Has STR should be suggested
 */
export function calculateHasStrSuggested(tags) {
  if (!tags || tags.length === 0) return false;

  const hasHasStr = hasTag(tags, TAG_IDS.HAS_STR);

  if (hasHasStr) return false;

  // Check for any tag that suggests STR
  const suggestsTags = [
    TAG_IDS.TEST_ATTACHED,
    TAG_IDS.FUZZY_TEST_ATTACHED,
    TAG_IDS.AI_DETECTED_STR,
    TAG_IDS.AI_DETECTED_TEST_ATTACHED,
  ];

  return suggestsTags.some((tagId) => hasTag(tags, tagId));
}

/**
 * Check if a bug has a specific tag.
 * @param {Object[]} tags - Array of tag objects
 * @param {string} tagId - Tag ID to check
 * @returns {boolean} True if tag is present
 */
export function hasTag(tags, tagId) {
  if (!tags || !Array.isArray(tags)) return false;
  // Support both 'id' and 'tag' property for backwards compatibility
  return tags.some((t) => t.id === tagId || t.tag === tagId);
}

console.log('[tags] Module loaded');
