/**
 * @fileoverview Bug filtering module.
 *
 * Responsibilities:
 * - Filter bugs by tags (AND logic)
 * - Filter by tag difference (include AND, exclude NOT)
 * - Provide preset filters
 *
 * @module filters
 */

import { TAG_IDS } from './tags.js';

/**
 * Filter presets.
 * Each preset has include[] and exclude[] arrays of tag IDs.
 */
export const PRESETS = {
  'fuzzing-testcase': {
    label: 'Fuzzing testcase',
    include: [TAG_IDS.FUZZY_TEST_ATTACHED],
    exclude: [],
  },
  'ai-str-no-has-str': {
    label: 'AI STR but no Has STR',
    include: [TAG_IDS.AI_DETECTED_STR],
    exclude: [TAG_IDS.HAS_STR],
  },
  'ai-str-test-no-formal': {
    label: 'AI STR + test, no formal tags',
    include: [TAG_IDS.AI_DETECTED_STR, TAG_IDS.AI_DETECTED_TEST_ATTACHED],
    exclude: [TAG_IDS.HAS_STR, TAG_IDS.TEST_ATTACHED],
  },
  'needs-review': {
    label: 'Needs review (AI found STR)',
    include: [TAG_IDS.AI_DETECTED_STR],
    exclude: [],
  },
};

/**
 * Check if a bug has a specific tag.
 * Supports both 'id' and 'tag' property for backwards compatibility.
 * @param {Object} bug - Bug object
 * @param {string} tagId - Tag ID to check
 * @returns {boolean} True if bug has the tag
 */
function bugHasTag(bug, tagId) {
  if (!bug || !bug.tags || !Array.isArray(bug.tags)) {
    return false;
  }
  return bug.tags.some((t) => t.id === tagId || t.tag === tagId);
}

/**
 * Check if a bug has ALL specified tags.
 * @param {Object} bug - Bug object
 * @param {string[]} tagIds - Array of tag IDs to check
 * @returns {boolean} True if bug has all tags
 */
export function hasAllTags(bug, tagIds) {
  if (!bug) return false;
  if (!tagIds || tagIds.length === 0) return true;
  return tagIds.every((tagId) => bugHasTag(bug, tagId));
}

/**
 * Check if a bug has ANY of the specified tags.
 * @param {Object} bug - Bug object
 * @param {string[]} tagIds - Array of tag IDs to check
 * @returns {boolean} True if bug has at least one tag
 */
export function hasAnyTag(bug, tagIds) {
  if (!bug) return false;
  if (!tagIds || tagIds.length === 0) return false;
  return tagIds.some((tagId) => bugHasTag(bug, tagId));
}

/**
 * Check if a bug has NONE of the specified tags.
 * @param {Object} bug - Bug object
 * @param {string[]} tagIds - Array of tag IDs to check
 * @returns {boolean} True if bug has none of the tags
 */
export function hasNoneOfTags(bug, tagIds) {
  if (!tagIds || tagIds.length === 0) return true;
  if (!bug || !bug.tags || !Array.isArray(bug.tags)) return true;
  return !tagIds.some((tagId) => bugHasTag(bug, tagId));
}

/**
 * Filter bugs by tags (AND logic - bug must have ALL tags).
 * @param {Object[]} bugs - Array of bug objects
 * @param {string[]} includeTags - Tag IDs that must be present
 * @returns {Object[]} Filtered bugs
 */
export function filterByTags(bugs, includeTags) {
  if (!bugs || !Array.isArray(bugs)) {
    return [];
  }

  if (!includeTags || includeTags.length === 0) {
    return bugs;
  }

  return bugs.filter((bug) => hasAllTags(bug, includeTags));
}

/**
 * Filter bugs by tag difference (include AND, exclude NOT).
 * @param {Object[]} bugs - Array of bug objects
 * @param {string[]} includeTags - Tag IDs that must be present
 * @param {string[]} excludeTags - Tag IDs that must NOT be present
 * @returns {Object[]} Filtered bugs
 */
export function filterByTagDifference(bugs, includeTags, excludeTags) {
  if (!bugs || !Array.isArray(bugs)) {
    return [];
  }

  if (
    (!includeTags || includeTags.length === 0) &&
    (!excludeTags || excludeTags.length === 0)
  ) {
    return bugs;
  }

  return bugs.filter((bug) => {
    // Must have ALL include tags
    const hasRequired = hasAllTags(bug, includeTags || []);

    // Must have NONE of exclude tags
    const hasExcluded = hasNoneOfTags(bug, excludeTags || []);

    return hasRequired && hasExcluded;
  });
}

/**
 * Apply a preset filter.
 * @param {Object[]} bugs - Array of bug objects
 * @param {string} presetId - Preset ID from PRESETS
 * @returns {Object[]} Filtered bugs
 */
export function applyPreset(bugs, presetId) {
  const preset = PRESETS[presetId];
  if (!preset) {
    console.warn('[filters] Unknown preset:', presetId);
    return bugs || [];
  }
  return filterByTagDifference(bugs, preset.include, preset.exclude);
}

/**
 * Get all available preset IDs.
 * @returns {string[]} Array of preset IDs
 */
export function getPresetIds() {
  return Object.keys(PRESETS);
}

/**
 * Get preset information by ID.
 * @param {string} presetId - Preset ID
 * @returns {Object|null} Preset object or null
 */
export function getPreset(presetId) {
  return PRESETS[presetId] || null;
}

console.log('[filters] Module loaded');
