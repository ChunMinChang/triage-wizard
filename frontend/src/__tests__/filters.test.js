/**
 * @fileoverview Tests for filters module (bug filtering engine)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRESETS,
  filterByTags,
  filterByTagDifference,
  applyPreset,
  getPresetIds,
  hasAllTags,
  hasAnyTag,
  hasNoneOfTags,
} from '../filters.js';
import { TAG_IDS } from '../tags.js';

describe('filters module', () => {
  /** Sample bugs for testing */
  const createBugs = () => [
    {
      id: 1,
      summary: 'Bug with Has STR',
      tags: [{ id: TAG_IDS.HAS_STR, label: 'Has STR' }],
    },
    {
      id: 2,
      summary: 'Bug with test-attached',
      tags: [{ id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' }],
    },
    {
      id: 3,
      summary: 'Bug with fuzzy-test-attached',
      tags: [{ id: TAG_IDS.FUZZY_TEST_ATTACHED, label: 'fuzzy-test-attached' }],
    },
    {
      id: 4,
      summary: 'Bug with crashstack',
      tags: [{ id: TAG_IDS.CRASHSTACK, label: 'crashstack' }],
    },
    {
      id: 5,
      summary: 'Bug with multiple tags',
      tags: [
        { id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' },
        { id: TAG_IDS.CRASHSTACK, label: 'crashstack' },
      ],
    },
    {
      id: 6,
      summary: 'Bug with no tags',
      tags: [],
    },
    {
      id: 7,
      summary: 'Bug with AI tags',
      tags: [
        { id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR' },
        { id: TAG_IDS.AI_DETECTED_TEST_ATTACHED, label: 'AI-detected test-attached' },
      ],
    },
    {
      id: 8,
      summary: 'Bug with Has STR and test-attached',
      tags: [
        { id: TAG_IDS.HAS_STR, label: 'Has STR' },
        { id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' },
      ],
    },
  ];

  describe('PRESETS', () => {
    it('should export fuzzing-testcase preset', () => {
      expect(PRESETS['fuzzing-testcase']).toBeDefined();
      expect(PRESETS['fuzzing-testcase'].include).toContain(TAG_IDS.FUZZY_TEST_ATTACHED);
      expect(PRESETS['fuzzing-testcase'].exclude).toEqual([]);
    });

    it('should have label for each preset', () => {
      Object.values(PRESETS).forEach((preset) => {
        expect(preset.label).toBeDefined();
        expect(typeof preset.label).toBe('string');
      });
    });

    it('should have include and exclude arrays for each preset', () => {
      Object.values(PRESETS).forEach((preset) => {
        expect(Array.isArray(preset.include)).toBe(true);
        expect(Array.isArray(preset.exclude)).toBe(true);
      });
    });
  });

  describe('hasAllTags', () => {
    it('should return true if bug has all specified tags', () => {
      const bug = {
        tags: [
          { id: TAG_IDS.TEST_ATTACHED },
          { id: TAG_IDS.CRASHSTACK },
        ],
      };
      expect(hasAllTags(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.CRASHSTACK])).toBe(true);
    });

    it('should return false if bug is missing any tag', () => {
      const bug = {
        tags: [{ id: TAG_IDS.TEST_ATTACHED }],
      };
      expect(hasAllTags(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.CRASHSTACK])).toBe(false);
    });

    it('should return true for empty tag list', () => {
      const bug = { tags: [] };
      expect(hasAllTags(bug, [])).toBe(true);
    });

    it('should handle bug with no tags array', () => {
      const bug = { id: 1 };
      expect(hasAllTags(bug, [TAG_IDS.HAS_STR])).toBe(false);
    });

    it('should handle null bug', () => {
      expect(hasAllTags(null, [TAG_IDS.HAS_STR])).toBe(false);
    });
  });

  describe('hasAnyTag', () => {
    it('should return true if bug has any of the specified tags', () => {
      const bug = {
        tags: [{ id: TAG_IDS.TEST_ATTACHED }],
      };
      expect(hasAnyTag(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.CRASHSTACK])).toBe(true);
    });

    it('should return false if bug has none of the specified tags', () => {
      const bug = {
        tags: [{ id: TAG_IDS.HAS_STR }],
      };
      expect(hasAnyTag(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.CRASHSTACK])).toBe(false);
    });

    it('should return false for empty tag list', () => {
      const bug = { tags: [{ id: TAG_IDS.HAS_STR }] };
      expect(hasAnyTag(bug, [])).toBe(false);
    });

    it('should handle bug with no tags', () => {
      const bug = { tags: [] };
      expect(hasAnyTag(bug, [TAG_IDS.HAS_STR])).toBe(false);
    });
  });

  describe('hasNoneOfTags', () => {
    it('should return true if bug has none of the specified tags', () => {
      const bug = {
        tags: [{ id: TAG_IDS.CRASHSTACK }],
      };
      expect(hasNoneOfTags(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.HAS_STR])).toBe(true);
    });

    it('should return false if bug has any of the specified tags', () => {
      const bug = {
        tags: [{ id: TAG_IDS.TEST_ATTACHED }],
      };
      expect(hasNoneOfTags(bug, [TAG_IDS.TEST_ATTACHED, TAG_IDS.HAS_STR])).toBe(false);
    });

    it('should return true for empty exclude list', () => {
      const bug = { tags: [{ id: TAG_IDS.HAS_STR }] };
      expect(hasNoneOfTags(bug, [])).toBe(true);
    });

    it('should return true for bug with no tags', () => {
      const bug = { tags: [] };
      expect(hasNoneOfTags(bug, [TAG_IDS.HAS_STR])).toBe(true);
    });
  });

  describe('filterByTags', () => {
    let bugs;

    beforeEach(() => {
      bugs = createBugs();
    });

    it('should return all bugs when includeTags is empty', () => {
      const result = filterByTags(bugs, []);
      expect(result.length).toBe(bugs.length);
    });

    it('should return all bugs when includeTags is null', () => {
      const result = filterByTags(bugs, null);
      expect(result.length).toBe(bugs.length);
    });

    it('should filter bugs by single tag', () => {
      const result = filterByTags(bugs, [TAG_IDS.HAS_STR]);
      expect(result.length).toBe(2); // Bug 1 and Bug 8
      expect(result.every((b) => b.tags.some((t) => t.id === TAG_IDS.HAS_STR))).toBe(true);
    });

    it('should filter bugs by multiple tags (AND logic)', () => {
      const result = filterByTags(bugs, [TAG_IDS.TEST_ATTACHED, TAG_IDS.CRASHSTACK]);
      expect(result.length).toBe(1); // Only Bug 5 has both
      expect(result[0].id).toBe(5);
    });

    it('should return empty array when no bugs match', () => {
      const result = filterByTags(bugs, [
        TAG_IDS.HAS_STR,
        TAG_IDS.FUZZY_TEST_ATTACHED,
      ]);
      expect(result).toEqual([]);
    });

    it('should handle bugs with no tags gracefully', () => {
      const result = filterByTags(bugs, [TAG_IDS.HAS_STR]);
      expect(result.some((b) => b.id === 6)).toBe(false); // Bug 6 has no tags
    });

    it('should return empty array for empty bugs array', () => {
      const result = filterByTags([], [TAG_IDS.HAS_STR]);
      expect(result).toEqual([]);
    });

    it('should not modify original array', () => {
      const original = [...bugs];
      filterByTags(bugs, [TAG_IDS.HAS_STR]);
      expect(bugs).toEqual(original);
    });
  });

  describe('filterByTagDifference', () => {
    let bugs;

    beforeEach(() => {
      bugs = createBugs();
    });

    it('should return all bugs when both include and exclude are empty', () => {
      const result = filterByTagDifference(bugs, [], []);
      expect(result.length).toBe(bugs.length);
    });

    it('should filter by include tags only', () => {
      const result = filterByTagDifference(bugs, [TAG_IDS.TEST_ATTACHED], []);
      expect(result.length).toBe(3); // Bug 2, 5, 8
      expect(result.every((b) => b.tags.some((t) => t.id === TAG_IDS.TEST_ATTACHED))).toBe(true);
    });

    it('should filter by exclude tags only', () => {
      const result = filterByTagDifference(bugs, [], [TAG_IDS.HAS_STR]);
      // All bugs except Bug 1 and Bug 8 (which have HAS_STR)
      expect(result.length).toBe(6);
      expect(result.every((b) => !b.tags.some((t) => t.id === TAG_IDS.HAS_STR))).toBe(true);
    });

    it('should filter by both include and exclude', () => {
      // Include test-attached, exclude Has STR
      const result = filterByTagDifference(
        bugs,
        [TAG_IDS.TEST_ATTACHED],
        [TAG_IDS.HAS_STR]
      );
      // Bug 2 and Bug 5 have test-attached, but Bug 8 also has Has STR so excluded
      expect(result.length).toBe(2);
      expect(result.map((b) => b.id).sort()).toEqual([2, 5]);
    });

    it('should handle AI tag filtering', () => {
      const result = filterByTagDifference(
        bugs,
        [TAG_IDS.AI_DETECTED_STR],
        [TAG_IDS.HAS_STR]
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(7);
    });

    it('should return empty array when filters conflict', () => {
      // Include and exclude same tag - nothing matches
      const result = filterByTagDifference(
        bugs,
        [TAG_IDS.HAS_STR],
        [TAG_IDS.HAS_STR]
      );
      expect(result).toEqual([]);
    });

    it('should not modify original array', () => {
      const original = [...bugs];
      filterByTagDifference(bugs, [TAG_IDS.HAS_STR], [TAG_IDS.CRASHSTACK]);
      expect(bugs).toEqual(original);
    });
  });

  describe('applyPreset', () => {
    let bugs;

    beforeEach(() => {
      bugs = createBugs();
    });

    it('should apply fuzzing-testcase preset', () => {
      const result = applyPreset(bugs, 'fuzzing-testcase');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(3); // Only bug with fuzzy-test-attached
    });

    it('should return all bugs for unknown preset', () => {
      const result = applyPreset(bugs, 'unknown-preset');
      expect(result.length).toBe(bugs.length);
    });

    it('should handle empty bugs array', () => {
      const result = applyPreset([], 'fuzzing-testcase');
      expect(result).toEqual([]);
    });
  });

  describe('getPresetIds', () => {
    it('should return array of preset IDs', () => {
      const ids = getPresetIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('fuzzing-testcase');
    });

    it('should match PRESETS keys', () => {
      const ids = getPresetIds();
      expect(ids).toEqual(Object.keys(PRESETS));
    });
  });

  describe('edge cases', () => {
    it('should handle bugs with undefined tags', () => {
      const bugsWithUndefined = [
        { id: 1, tags: undefined },
        { id: 2, tags: [{ id: TAG_IDS.HAS_STR }] },
      ];
      const result = filterByTags(bugsWithUndefined, [TAG_IDS.HAS_STR]);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(2);
    });

    it('should handle null bugs array', () => {
      const result = filterByTags(null, [TAG_IDS.HAS_STR]);
      expect(result).toEqual([]);
    });

    it('should handle undefined bugs array', () => {
      const result = filterByTags(undefined, [TAG_IDS.HAS_STR]);
      expect(result).toEqual([]);
    });

    it('should handle tags with tag property instead of id', () => {
      const bugsWithTagProperty = [
        { id: 1, tags: [{ tag: TAG_IDS.HAS_STR }] },
      ];
      const result = filterByTags(bugsWithTagProperty, [TAG_IDS.HAS_STR]);
      expect(result.length).toBe(1);
    });
  });

  describe('filter combinations', () => {
    let bugs;

    beforeEach(() => {
      bugs = createBugs();
    });

    it('should find bugs with test-attached but no Has STR', () => {
      const result = filterByTagDifference(
        bugs,
        [TAG_IDS.TEST_ATTACHED],
        [TAG_IDS.HAS_STR]
      );
      expect(result.map((b) => b.id).sort()).toEqual([2, 5]);
    });

    it('should find bugs with AI-detected STR but no Has STR', () => {
      const result = filterByTagDifference(
        bugs,
        [TAG_IDS.AI_DETECTED_STR],
        [TAG_IDS.HAS_STR]
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(7);
    });

    it('should find bugs with crashstack and test-attached', () => {
      const result = filterByTags(bugs, [TAG_IDS.CRASHSTACK, TAG_IDS.TEST_ATTACHED]);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(5);
    });

    it('should find bugs with no tags', () => {
      const result = filterByTagDifference(
        bugs,
        [],
        [
          TAG_IDS.HAS_STR,
          TAG_IDS.TEST_ATTACHED,
          TAG_IDS.FUZZY_TEST_ATTACHED,
          TAG_IDS.CRASHSTACK,
          TAG_IDS.AI_DETECTED_STR,
          TAG_IDS.AI_DETECTED_TEST_ATTACHED,
        ]
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(6);
    });
  });

  describe('AI filter presets (L3-F4)', () => {
    const bugsForAiPresets = [
      {
        id: 1,
        summary: 'Bug with Has STR (formal)',
        tags: [{ id: TAG_IDS.HAS_STR, label: 'Has STR' }],
      },
      {
        id: 2,
        summary: 'Bug with AI-detected STR but no formal Has STR',
        tags: [{ id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR' }],
      },
      {
        id: 3,
        summary: 'Bug with AI STR and AI test-attached',
        tags: [
          { id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR' },
          { id: TAG_IDS.AI_DETECTED_TEST_ATTACHED, label: 'AI-detected test-attached' },
        ],
      },
      {
        id: 4,
        summary: 'Bug with AI STR and formal test-attached',
        tags: [
          { id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR' },
          { id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' },
        ],
      },
      {
        id: 5,
        summary: 'Bug with no STR or test tags',
        tags: [{ id: TAG_IDS.CRASHSTACK, label: 'crashstack' }],
      },
    ];

    it('should export ai-str-no-has-str preset', () => {
      expect(PRESETS['ai-str-no-has-str']).toBeDefined();
      expect(PRESETS['ai-str-no-has-str'].include).toContain(TAG_IDS.AI_DETECTED_STR);
      expect(PRESETS['ai-str-no-has-str'].exclude).toContain(TAG_IDS.HAS_STR);
    });

    it('should filter ai-str-no-has-str correctly', () => {
      const result = applyPreset(bugsForAiPresets, 'ai-str-no-has-str');
      // Should include bugs 2, 3, 4 (have AI STR but not formal Has STR)
      expect(result.length).toBe(3);
      expect(result.map((b) => b.id).sort()).toEqual([2, 3, 4]);
    });

    it('should export ai-str-test-no-formal preset', () => {
      expect(PRESETS['ai-str-test-no-formal']).toBeDefined();
      expect(PRESETS['ai-str-test-no-formal'].include).toContain(TAG_IDS.AI_DETECTED_STR);
      expect(PRESETS['ai-str-test-no-formal'].include).toContain(TAG_IDS.AI_DETECTED_TEST_ATTACHED);
      expect(PRESETS['ai-str-test-no-formal'].exclude).toContain(TAG_IDS.HAS_STR);
      expect(PRESETS['ai-str-test-no-formal'].exclude).toContain(TAG_IDS.TEST_ATTACHED);
    });

    it('should filter ai-str-test-no-formal correctly', () => {
      const result = applyPreset(bugsForAiPresets, 'ai-str-test-no-formal');
      // Should only include bug 3 (has both AI STR and AI test, but no formal tags)
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(3);
    });

    it('should export needs-review preset', () => {
      expect(PRESETS['needs-review']).toBeDefined();
      expect(PRESETS['needs-review'].include).toContain(TAG_IDS.AI_DETECTED_STR);
    });

    it('should filter needs-review correctly', () => {
      const result = applyPreset(bugsForAiPresets, 'needs-review');
      // Should include bugs 2, 3, 4 (all have AI STR)
      expect(result.length).toBe(3);
      expect(result.map((b) => b.id).sort()).toEqual([2, 3, 4]);
    });
  });
});
