/**
 * @fileoverview Tests for tags module (heuristic tagging engine)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TAG_IDS,
  AI_ONLY_TAGS,
  NON_AI_TAGS,
  computeHeuristicTags,
  mergeAiTags,
  calculateHasStrSuggested,
  hasTag,
  checkHasStr,
  checkTestAttached,
  checkFuzzyTestAttached,
  checkCrashstack,
} from '../tags.js';

describe('tags module', () => {
  describe('constants', () => {
    it('should export TAG_IDS with all tag types', () => {
      expect(TAG_IDS.HAS_STR).toBe('has-str');
      expect(TAG_IDS.TEST_ATTACHED).toBe('test-attached');
      expect(TAG_IDS.FUZZY_TEST_ATTACHED).toBe('fuzzy-test-attached');
      expect(TAG_IDS.CRASHSTACK).toBe('crashstack');
      expect(TAG_IDS.AI_DETECTED_STR).toBe('ai-detected-str');
      expect(TAG_IDS.AI_DETECTED_TEST_ATTACHED).toBe('ai-detected-test-attached');
    });

    it('should export AI_ONLY_TAGS array', () => {
      expect(AI_ONLY_TAGS).toContain(TAG_IDS.AI_DETECTED_STR);
      expect(AI_ONLY_TAGS).toContain(TAG_IDS.AI_DETECTED_TEST_ATTACHED);
      expect(AI_ONLY_TAGS).not.toContain(TAG_IDS.TEST_ATTACHED);
    });

    it('should export NON_AI_TAGS array', () => {
      expect(NON_AI_TAGS).toContain(TAG_IDS.TEST_ATTACHED);
      expect(NON_AI_TAGS).not.toContain(TAG_IDS.AI_DETECTED_STR);
    });
  });

  describe('checkHasStr', () => {
    it('should return tag when cf_has_str is "yes"', () => {
      const bug = { cf_has_str: 'yes' };
      const result = checkHasStr(bug);

      expect(result).not.toBeNull();
      expect(result.id).toBe(TAG_IDS.HAS_STR);
      expect(result.label).toBe('Has STR');
      expect(result.source).toContain('bug-field');
    });

    it('should return null when cf_has_str is "no"', () => {
      const bug = { cf_has_str: 'no' };
      const result = checkHasStr(bug);
      expect(result).toBeNull();
    });

    it('should return null when cf_has_str is "---"', () => {
      const bug = { cf_has_str: '---' };
      const result = checkHasStr(bug);
      expect(result).toBeNull();
    });

    it('should return null when cf_has_str is empty', () => {
      const bug = { cf_has_str: '' };
      const result = checkHasStr(bug);
      expect(result).toBeNull();
    });

    it('should return null when cf_has_str is undefined', () => {
      const bug = {};
      const result = checkHasStr(bug);
      expect(result).toBeNull();
    });

    it('should handle cfHasStr alias', () => {
      const bug = { cfHasStr: 'yes' };
      const result = checkHasStr(bug);
      expect(result).not.toBeNull();
      expect(result.id).toBe(TAG_IDS.HAS_STR);
    });
  });

  describe('checkTestAttached', () => {
    describe('via keywords', () => {
      it('should detect testcase keyword', () => {
        const bug = { keywords: ['testcase'] };
        const result = checkTestAttached(bug);

        expect(result).not.toBeNull();
        expect(result.id).toBe(TAG_IDS.TEST_ATTACHED);
        expect(result.source).toContain('bug-field');
        expect(result.evidence).toContain('testcase');
      });

      it('should detect testcase in comma-separated keywords string', () => {
        const bug = { keywords: 'regression, testcase, crash' };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should not match partial keyword', () => {
        const bug = { keywords: ['testcases-wanted'] };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });
    });

    describe('via attachments', () => {
      const baseAttachment = {
        id: 1,
        is_obsolete: false,
        is_patch: false,
        is_private: false,
      };

      it('should detect attachment with testcase in filename', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'testcase.html' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
        expect(result.source).toContain('attachment');
      });

      it('should detect attachment with repro in filename', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'repro.js' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect attachment with poc in filename', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'poc.html' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect attachment with reduced in filename', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'reduced-crash.html' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect attachment with min/minimized in filename', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'minimized.js' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();

        const bug2 = {
          attachments: [{ ...baseAttachment, file_name: 'min_repro.html' }],
        };
        expect(checkTestAttached(bug2)).not.toBeNull();
      });

      it('should detect .html extension', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'something.html' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect .js extension', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'crash.js' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect .zip extension', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'testfiles.zip' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should NOT detect .txt extension (too generic, often logs)', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'logs.txt' }],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should NOT detect .xhtml extension (removed to reduce false positives)', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'test.xhtml' }],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should NOT detect .mjs extension (removed to reduce false positives)', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'module.mjs' }],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should still detect testcase.txt via filename pattern', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'testcase.txt' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
        expect(result.evidence).toContain('filename matches testcase pattern');
      });

      it('should skip obsolete attachments', () => {
        const bug = {
          attachments: [
            { ...baseAttachment, file_name: 'testcase.html', is_obsolete: true },
          ],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should skip patch attachments', () => {
        const bug = {
          attachments: [
            { ...baseAttachment, file_name: 'fix.patch', is_patch: true },
          ],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should skip private attachments', () => {
        const bug = {
          attachments: [
            { ...baseAttachment, file_name: 'testcase.html', is_private: true },
          ],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });

      it('should not detect generic file extensions', () => {
        const bug = {
          attachments: [{ ...baseAttachment, file_name: 'screenshot.png' }],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });
    });

    describe('via flags', () => {
      it('should detect in-testsuite+ flag', () => {
        const bug = {
          flags: [{ name: 'in-testsuite', status: '+' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
        expect(result.source).toContain('bug-field');
        expect(result.evidence).toContain('in-testsuite');
      });

      it('should detect in-qa-testsuite flag', () => {
        const bug = {
          flags: [{ name: 'in-qa-testsuite', status: '+' }],
        };
        const result = checkTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should not match in-testsuite? flag', () => {
        const bug = {
          flags: [{ name: 'in-testsuite', status: '?' }],
        };
        const result = checkTestAttached(bug);
        expect(result).toBeNull();
      });
    });
  });

  describe('checkFuzzyTestAttached', () => {
    describe('via comments', () => {
      it('should detect "Found while fuzzing"', () => {
        const bug = {
          comments: [{ text: 'Found while fuzzing with grizzly' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
        expect(result.id).toBe(TAG_IDS.FUZZY_TEST_ATTACHED);
        expect(result.source).toContain('heuristic');
      });

      it('should detect fuzzilli reference', () => {
        const bug = {
          comments: [{ text: 'Crash found by fuzzilli' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect oss-fuzz reference', () => {
        const bug = {
          comments: [{ text: 'https://oss-fuzz.com/testcase/123' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect fuzzfetch reference', () => {
        const bug = {
          comments: [{ text: 'Using fuzzfetch to get a build' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should detect Grizzly Replay reference', () => {
        const bug = {
          comments: [{ text: 'Grizzly Replay attached' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });

      it('should be case insensitive', () => {
        const bug = {
          comments: [{ text: 'FOUND WHILE FUZZING' }],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });
    });

    describe('via description', () => {
      it('should check description for fuzzing signals', () => {
        const bug = {
          description: 'Found while fuzzing SpiderMonkey',
          comments: [],
        };
        const result = checkFuzzyTestAttached(bug);
        expect(result).not.toBeNull();
      });
    });

    it('should return null if no fuzzing signals', () => {
      const bug = {
        comments: [{ text: 'This is a regular bug' }],
      };
      const result = checkFuzzyTestAttached(bug);
      expect(result).toBeNull();
    });
  });

  describe('checkCrashstack', () => {
    describe('via cf_crash_signature', () => {
      it('should detect non-empty crash signature', () => {
        const bug = {
          cf_crash_signature: '[@ mozilla::dom::Element::GetAttribute]',
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
        expect(result.id).toBe(TAG_IDS.CRASHSTACK);
        expect(result.source).toContain('bug-field');
      });

      it('should handle cfCrashSignature alias', () => {
        const bug = {
          cfCrashSignature: '[@ some_function]',
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should return null for empty signature', () => {
        const bug = { cf_crash_signature: '' };
        const result = checkCrashstack(bug);
        expect(result).toBeNull();
      });
    });

    describe('via comments', () => {
      it('should detect #0 stack frame pattern', () => {
        const bug = {
          comments: [{ text: '#0 0x7fff12345678 in foo()' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
        expect(result.source).toContain('heuristic');
      });

      it('should detect #1 stack frame pattern', () => {
        const bug = {
          comments: [{ text: 'Crash:\n#1 0x12345 in bar\n#2 0x23456 in baz' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect AddressSanitizer', () => {
        const bug = {
          comments: [{ text: '==12345==ERROR: AddressSanitizer: heap-buffer-overflow' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect ASan (short form)', () => {
        const bug = {
          comments: [{ text: 'ASan detected use-after-free' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect UndefinedBehaviorSanitizer', () => {
        const bug = {
          comments: [{ text: 'UndefinedBehaviorSanitizer: integer overflow' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect UBSan (short form)', () => {
        const bug = {
          comments: [{ text: 'UBSan: shift exponent is negative' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect ThreadSanitizer', () => {
        const bug = {
          comments: [{ text: 'ThreadSanitizer: data race' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect TSan (short form)', () => {
        const bug = {
          comments: [{ text: 'TSan warning: data race' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect MemorySanitizer', () => {
        const bug = {
          comments: [{ text: 'MemorySanitizer: use-of-uninitialized-value' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });

      it('should detect MSan (short form)', () => {
        const bug = {
          comments: [{ text: 'MSan error detected' }],
        };
        const result = checkCrashstack(bug);
        expect(result).not.toBeNull();
      });
    });

    it('should return null if no crash signals', () => {
      const bug = {
        cf_crash_signature: '',
        comments: [{ text: 'Just a regular comment' }],
      };
      const result = checkCrashstack(bug);
      expect(result).toBeNull();
    });
  });

  describe('computeHeuristicTags', () => {
    it('should return empty array for bug with no signals', () => {
      const bug = { id: 123, summary: 'Regular bug' };
      const tags = computeHeuristicTags(bug);
      expect(tags).toEqual([]);
    });

    it('should compute Has STR tag', () => {
      const bug = { id: 123, cf_has_str: 'yes' };
      const tags = computeHeuristicTags(bug);
      expect(tags.some((t) => t.id === TAG_IDS.HAS_STR)).toBe(true);
    });

    it('should compute test-attached tag from keyword', () => {
      const bug = { id: 123, keywords: ['testcase'] };
      const tags = computeHeuristicTags(bug);
      expect(tags.some((t) => t.id === TAG_IDS.TEST_ATTACHED)).toBe(true);
    });

    it('should compute fuzzy-test-attached tag', () => {
      const bug = {
        id: 123,
        comments: [{ text: 'Found while fuzzing' }],
      };
      const tags = computeHeuristicTags(bug);
      expect(tags.some((t) => t.id === TAG_IDS.FUZZY_TEST_ATTACHED)).toBe(true);
    });

    it('should compute crashstack tag', () => {
      const bug = {
        id: 123,
        cf_crash_signature: '[@ crash]',
      };
      const tags = computeHeuristicTags(bug);
      expect(tags.some((t) => t.id === TAG_IDS.CRASHSTACK)).toBe(true);
    });

    it('should compute multiple tags when applicable', () => {
      const bug = {
        id: 123,
        cf_has_str: 'yes',
        keywords: ['testcase'],
        cf_crash_signature: '[@ crash]',
      };
      const tags = computeHeuristicTags(bug);
      expect(tags.length).toBeGreaterThanOrEqual(3);
      expect(tags.some((t) => t.id === TAG_IDS.HAS_STR)).toBe(true);
      expect(tags.some((t) => t.id === TAG_IDS.TEST_ATTACHED)).toBe(true);
      expect(tags.some((t) => t.id === TAG_IDS.CRASHSTACK)).toBe(true);
    });

    it('should not include AI tags', () => {
      const bug = { id: 123 };
      const tags = computeHeuristicTags(bug);
      expect(tags.some((t) => t.id === TAG_IDS.AI_DETECTED_STR)).toBe(false);
      expect(tags.some((t) => t.id === TAG_IDS.AI_DETECTED_TEST_ATTACHED)).toBe(false);
    });
  });

  describe('mergeAiTags', () => {
    it('should add AI-detected STR tag', () => {
      const existingTags = [];
      const aiResult = { ai_detected_str: true };
      const merged = mergeAiTags(existingTags, aiResult);
      expect(merged.some((t) => t.id === TAG_IDS.AI_DETECTED_STR)).toBe(true);
    });

    it('should add AI-detected test-attached tag', () => {
      const existingTags = [];
      const aiResult = { ai_detected_test_attached: true };
      const merged = mergeAiTags(existingTags, aiResult);
      expect(merged.some((t) => t.id === TAG_IDS.AI_DETECTED_TEST_ATTACHED)).toBe(true);
    });

    it('should preserve existing tags', () => {
      const existingTags = [
        { id: TAG_IDS.HAS_STR, label: 'Has STR', source: ['bug-field'] },
      ];
      const aiResult = { ai_detected_str: true };
      const merged = mergeAiTags(existingTags, aiResult);
      expect(merged.some((t) => t.id === TAG_IDS.HAS_STR)).toBe(true);
      expect(merged.some((t) => t.id === TAG_IDS.AI_DETECTED_STR)).toBe(true);
    });

    it('should NOT add test-attached from AI (enforces NON_AI_TAGS rule)', () => {
      const existingTags = [];
      const aiResult = { test_attached: true }; // AI tries to set this
      const merged = mergeAiTags(existingTags, aiResult);
      expect(merged.some((t) => t.id === TAG_IDS.TEST_ATTACHED)).toBe(false);
    });

    it('should include AI evidence in tag', () => {
      const existingTags = [];
      const aiResult = {
        ai_detected_str: true,
        ai_evidence: 'Found clear reproduction steps in comment 3',
      };
      const merged = mergeAiTags(existingTags, aiResult);
      const aiTag = merged.find((t) => t.id === TAG_IDS.AI_DETECTED_STR);
      expect(aiTag.evidence).toBeTruthy();
      expect(aiTag.source).toContain('ai');
    });

    it('should handle null/undefined aiResult', () => {
      const existingTags = [{ id: TAG_IDS.HAS_STR, label: 'Has STR', source: ['bug-field'] }];
      const merged = mergeAiTags(existingTags, null);
      expect(merged).toEqual(existingTags);
    });

    it('should not duplicate existing tags', () => {
      const existingTags = [
        { id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR', source: ['ai'] },
      ];
      const aiResult = { ai_detected_str: true };
      const merged = mergeAiTags(existingTags, aiResult);
      const aiTags = merged.filter((t) => t.id === TAG_IDS.AI_DETECTED_STR);
      expect(aiTags.length).toBe(1);
    });
  });

  describe('calculateHasStrSuggested', () => {
    it('should return false when no relevant tags', () => {
      const tags = [];
      expect(calculateHasStrSuggested(tags)).toBe(false);
    });

    it('should return true when test-attached and no Has STR', () => {
      const tags = [{ id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' }];
      expect(calculateHasStrSuggested(tags)).toBe(true);
    });

    it('should return true when fuzzy-test-attached and no Has STR', () => {
      const tags = [{ id: TAG_IDS.FUZZY_TEST_ATTACHED, label: 'fuzzy-test-attached' }];
      expect(calculateHasStrSuggested(tags)).toBe(true);
    });

    it('should return false when Has STR is already set', () => {
      const tags = [
        { id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' },
        { id: TAG_IDS.HAS_STR, label: 'Has STR' },
      ];
      expect(calculateHasStrSuggested(tags)).toBe(false);
    });

    it('should return true when AI-detected STR and no Has STR', () => {
      const tags = [{ id: TAG_IDS.AI_DETECTED_STR, label: 'AI-detected STR' }];
      expect(calculateHasStrSuggested(tags)).toBe(true);
    });

    it('should return true when AI-detected test-attached and no Has STR', () => {
      const tags = [{ id: TAG_IDS.AI_DETECTED_TEST_ATTACHED, label: 'AI-detected test-attached' }];
      expect(calculateHasStrSuggested(tags)).toBe(true);
    });

    it('should handle combined tags correctly', () => {
      const tags = [
        { id: TAG_IDS.TEST_ATTACHED, label: 'test-attached' },
        { id: TAG_IDS.CRASHSTACK, label: 'crashstack' },
      ];
      expect(calculateHasStrSuggested(tags)).toBe(true);
    });

    it('should return false when only crashstack is present', () => {
      const tags = [{ id: TAG_IDS.CRASHSTACK, label: 'crashstack' }];
      expect(calculateHasStrSuggested(tags)).toBe(false);
    });
  });

  describe('hasTag', () => {
    it('should return true when tag is present', () => {
      const tags = [{ id: TAG_IDS.HAS_STR, label: 'Has STR' }];
      expect(hasTag(tags, TAG_IDS.HAS_STR)).toBe(true);
    });

    it('should return false when tag is not present', () => {
      const tags = [{ id: TAG_IDS.HAS_STR, label: 'Has STR' }];
      expect(hasTag(tags, TAG_IDS.TEST_ATTACHED)).toBe(false);
    });

    it('should return false for empty tags array', () => {
      expect(hasTag([], TAG_IDS.HAS_STR)).toBe(false);
    });

    it('should work with tag property (backwards compatibility)', () => {
      const tags = [{ tag: TAG_IDS.HAS_STR, label: 'Has STR' }];
      expect(hasTag(tags, TAG_IDS.HAS_STR)).toBe(true);
    });
  });

  describe('tag structure', () => {
    it('should have required properties: id, label, source, evidence', () => {
      const bug = { cf_has_str: 'yes' };
      const tags = computeHeuristicTags(bug);
      const tag = tags[0];

      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('label');
      expect(tag).toHaveProperty('source');
      expect(Array.isArray(tag.source)).toBe(true);
      expect(tag).toHaveProperty('evidence');
    });
  });

  describe('edge cases', () => {
    it('should handle null bug', () => {
      const tags = computeHeuristicTags(null);
      expect(tags).toEqual([]);
    });

    it('should handle undefined bug', () => {
      const tags = computeHeuristicTags(undefined);
      expect(tags).toEqual([]);
    });

    it('should handle bug with empty fields', () => {
      const bug = {
        id: 123,
        cf_has_str: '',
        keywords: [],
        attachments: [],
        flags: [],
        comments: [],
        cf_crash_signature: '',
      };
      const tags = computeHeuristicTags(bug);
      expect(tags).toEqual([]);
    });
  });
});
