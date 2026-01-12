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
  // AI presets will be added in L3-F4:
  // 'ai-str-no-has-str': { include: [AI_DETECTED_STR], exclude: [HAS_STR] }
  // 'ai-str-test-no-formal': { include: [AI_DETECTED_STR, AI_DETECTED_TEST_ATTACHED], exclude: [HAS_STR, TEST_ATTACHED] }
};

/**
 * Filter bugs by tags (AND logic - bug must have ALL tags).
 * @param {Object[]} bugs - Array of bug objects
 * @param {string[]} includeTags - Tag IDs that must be present
 * @returns {Object[]} Filtered bugs
 */
export function filterByTags(bugs, includeTags) {
  if (!includeTags || includeTags.length === 0) {
    return bugs;
  }
  // TODO: Filter bugs that have ALL includeTags
  console.log('[filters] Filtering by tags:', includeTags);
  return bugs;
}

/**
 * Filter bugs by tag difference (include AND, exclude NOT).
 * @param {Object[]} bugs - Array of bug objects
 * @param {string[]} includeTags - Tag IDs that must be present
 * @param {string[]} excludeTags - Tag IDs that must NOT be present
 * @returns {Object[]} Filtered bugs
 */
export function filterByTagDifference(bugs, includeTags, excludeTags) {
  if ((!includeTags || includeTags.length === 0) &&
      (!excludeTags || excludeTags.length === 0)) {
    return bugs;
  }
  // TODO: Filter bugs matching include AND NOT exclude
  console.log('[filters] Filtering by difference:', { includeTags, excludeTags });
  return bugs;
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
    return bugs;
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

console.log('[filters] Module loaded');
