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

/** Tags that can ONLY be set by AI */
export const AI_ONLY_TAGS = [
  TAG_IDS.AI_DETECTED_STR,
  TAG_IDS.AI_DETECTED_TEST_ATTACHED,
];

/** Tags that can NEVER be set by AI */
export const NON_AI_TAGS = [
  TAG_IDS.TEST_ATTACHED,
];

/**
 * Compute heuristic tags for a bug.
 * @param {Object} bug - Bug object with metadata, attachments, comments
 * @returns {Object[]} Array of tag objects { tag, source[], evidence }
 */
export function computeHeuristicTags(bug) {
  // TODO: Check cf_has_str, keywords, attachments, text patterns
  console.log('[tags] Computing heuristic tags for:', bug?.id);
  return [];
}

/**
 * Merge AI tags with existing tags.
 * Enforces semantic rule: AI never sets test-attached.
 * @param {Object[]} existingTags - Current tags
 * @param {Object} aiResult - AI classification result
 * @returns {Object[]} Merged tags
 */
export function mergeAiTags(existingTags, aiResult) {
  // TODO: Add AI tags, enforce NON_AI_TAGS rule
  console.log('[tags] Merging AI tags');
  return existingTags;
}

/**
 * Calculate whether to suggest setting Has STR.
 * Initial formula (heuristic only):
 *   hasStrSuggested = (test-attached OR fuzzy-test-attached) AND NOT Has STR
 *
 * After AI (L3-F4):
 *   hasStrSuggested = (test-attached OR fuzzy-test-attached OR
 *                      AI-detected STR OR AI-detected test-attached) AND NOT Has STR
 *
 * @param {Object[]} tags - Array of tag objects
 * @returns {boolean} True if Has STR should be suggested
 */
export function calculateHasStrSuggested(tags) {
  // TODO: Implement formula
  console.log('[tags] Calculating hasStrSuggested');
  return false;
}

/**
 * Check if a bug has a specific tag.
 * @param {Object[]} tags - Array of tag objects
 * @param {string} tagId - Tag ID to check
 * @returns {boolean} True if tag is present
 */
export function hasTag(tags, tagId) {
  return tags.some(t => t.tag === tagId);
}

console.log('[tags] Module loaded');
