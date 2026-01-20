/**
 * @fileoverview Tests for exports module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SCHEMA_VERSION,
  exportJSON,
  exportCSV,
  exportMarkdown,
  importJSON,
  migrateSchema,
  downloadFile,
  generateFilename,
} from '../exports.js';

describe('exports module', () => {
  /** Sample bugs for testing */
  const createSampleBugs = () => [
    {
      id: 123456,
      summary: 'Test bug with comma, and "quotes"',
      status: 'NEW',
      resolution: '',
      product: 'Firefox',
      component: 'General',
      severity: 'normal',
      priority: 'P3',
      cfHasStr: 'yes',
      hasStrSuggested: false,
      tags: [
        { id: 'has-str', label: 'Has STR' },
        { id: 'test-attached', label: 'test-attached' },
      ],
      aiSummary: 'This is an AI summary of the bug.',
    },
    {
      id: 234567,
      summary: 'Another bug with newlines\nin summary',
      status: 'RESOLVED',
      resolution: 'FIXED',
      product: 'Core',
      component: 'JavaScript Engine',
      severity: 'critical',
      priority: 'P1',
      cfHasStr: '',
      hasStrSuggested: true,
      tags: [{ id: 'crashstack', label: 'crashstack' }],
      aiSummary: '',
    },
  ];

  describe('SCHEMA_VERSION', () => {
    it('should export a schema version', () => {
      expect(SCHEMA_VERSION).toBe(1);
    });
  });

  describe('exportJSON', () => {
    it('should export bugs as JSON string', () => {
      const bugs = createSampleBugs();
      const result = exportJSON(bugs, { bugzillaHost: 'https://bugzilla.mozilla.org' });
      const parsed = JSON.parse(result);

      expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
      expect(parsed.bugs).toHaveLength(2);
      expect(parsed.bugzillaHost).toBe('https://bugzilla.mozilla.org');
      expect(parsed.generatedAt).toBeDefined();
    });

    it('should include AI metadata', () => {
      const bugs = createSampleBugs();
      const metadata = {
        aiProvider: 'gemini',
        aiModel: 'gemini-pro',
        aiTransport: 'browser',
      };
      const result = exportJSON(bugs, metadata);
      const parsed = JSON.parse(result);

      expect(parsed.ai.provider).toBe('gemini');
      expect(parsed.ai.model).toBe('gemini-pro');
      expect(parsed.ai.transport).toBe('browser');
    });

    it('should handle empty bugs array', () => {
      const result = exportJSON([], {});
      const parsed = JSON.parse(result);

      expect(parsed.bugs).toHaveLength(0);
    });

    it('should handle null/undefined bugs', () => {
      const result = exportJSON(null, {});
      const parsed = JSON.parse(result);

      expect(parsed.bugs).toEqual([]);
    });

    it('should preserve all bug properties', () => {
      const bugs = createSampleBugs();
      const result = exportJSON(bugs, {});
      const parsed = JSON.parse(result);

      expect(parsed.bugs[0].id).toBe(123456);
      expect(parsed.bugs[0].summary).toBe('Test bug with comma, and "quotes"');
      expect(parsed.bugs[0].tags).toHaveLength(2);
    });
  });

  describe('exportCSV', () => {
    it('should export bugs as CSV string', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, { bugzillaHost: 'https://bugzilla.mozilla.org' });

      // Should contain header and bug IDs
      expect(result).toContain('bug_id,bug_url');
      expect(result).toContain('123456');
      expect(result).toContain('234567');
    });

    it('should include header row', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, {});
      const header = result.split('\n')[0];

      expect(header).toContain('bug_id');
      expect(header).toContain('summary');
      expect(header).toContain('tags');
    });

    it('should escape values with commas', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, {});

      // Summary with comma should be quoted
      expect(result).toContain('"Test bug with comma, and ""quotes"""');
    });

    it('should escape values with quotes', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, {});

      // Double quotes should be escaped as ""
      expect(result).toContain('""quotes""');
    });

    it('should handle newlines in values', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, {});

      // Newlines should cause quoting
      expect(result).toContain('"Another bug with newlines');
    });

    it('should return empty string for empty bugs array', () => {
      const result = exportCSV([], {});
      expect(result).toBe('');
    });

    it('should return empty string for null bugs', () => {
      const result = exportCSV(null, {});
      expect(result).toBe('');
    });

    it('should join tags with semicolon', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, {});

      expect(result).toContain('has-str; test-attached');
    });

    it('should include bug URL', () => {
      const bugs = createSampleBugs();
      const result = exportCSV(bugs, { bugzillaHost: 'https://test.bugzilla.org' });

      expect(result).toContain('https://test.bugzilla.org/show_bug.cgi?id=123456');
    });
  });

  describe('exportMarkdown', () => {
    it('should export bugs as Markdown table', () => {
      const bugs = createSampleBugs();
      const result = exportMarkdown(bugs, { bugzillaHost: 'https://bugzilla.mozilla.org' });

      expect(result).toContain('# Bug Triage Report');
      expect(result).toContain('| Bug ID |');
      expect(result).toContain('| --- |');
    });

    it('should include bug links', () => {
      const bugs = createSampleBugs();
      const result = exportMarkdown(bugs, { bugzillaHost: 'https://bugzilla.mozilla.org' });

      expect(result).toContain('[123456](https://bugzilla.mozilla.org/show_bug.cgi?id=123456)');
    });

    it('should include tags as code', () => {
      const bugs = createSampleBugs();
      const result = exportMarkdown(bugs, {});

      expect(result).toContain('`has-str`');
      expect(result).toContain('`test-attached`');
    });

    it('should escape pipe characters', () => {
      const bugs = [
        {
          id: 1,
          summary: 'Bug with | pipe character',
          status: 'NEW',
          product: 'Firefox',
          component: 'General',
          tags: [],
        },
      ];
      const result = exportMarkdown(bugs, {});

      expect(result).toContain('\\|');
    });

    it('should handle empty bugs array', () => {
      const result = exportMarkdown([], {});

      expect(result).toContain('No bugs to export');
    });

    it('should show total bugs count', () => {
      const bugs = createSampleBugs();
      const result = exportMarkdown(bugs, {});

      expect(result).toContain('Total bugs: 2');
    });

    it('should include AI summary when requested', () => {
      const bugs = createSampleBugs();
      const result = exportMarkdown(bugs, { includeAiSummary: true });

      expect(result).toContain('AI Summary');
      expect(result).toContain('This is an AI summary');
    });

    it('should truncate long summaries', () => {
      const bugs = [
        {
          id: 1,
          summary: 'A'.repeat(100),
          status: 'NEW',
          product: 'Firefox',
          component: 'General',
          tags: [],
        },
      ];
      const result = exportMarkdown(bugs, {});

      // Summary should be truncated to 80 chars
      expect(result).toContain('A'.repeat(80));
      expect(result).not.toContain('A'.repeat(100));
    });
  });

  describe('importJSON', () => {
    it('should parse valid JSON export', () => {
      const bugs = createSampleBugs();
      const jsonStr = exportJSON(bugs, { bugzillaHost: 'https://bugzilla.mozilla.org' });
      const result = importJSON(jsonStr);

      expect(result.bugs).toHaveLength(2);
      expect(result.metadata.bugzillaHost).toBe('https://bugzilla.mozilla.org');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle invalid JSON', () => {
      const result = importJSON('not valid json');

      expect(result.bugs).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing bugs array', () => {
      const result = importJSON('{"schemaVersion": 1}');

      expect(result.bugs).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract metadata', () => {
      const jsonStr = JSON.stringify({
        schemaVersion: 1,
        bugzillaHost: 'https://test.mozilla.org',
        ai: { provider: 'claude', model: 'claude-3' },
        bugs: [],
      });
      const result = importJSON(jsonStr);

      expect(result.metadata.bugzillaHost).toBe('https://test.mozilla.org');
      expect(result.metadata.ai.provider).toBe('claude');
    });
  });

  describe('migrateSchema', () => {
    it('should return data unchanged if schema version matches', () => {
      const data = { schemaVersion: SCHEMA_VERSION, bugs: [{ id: 1 }] };
      const result = migrateSchema(data);

      expect(result).toEqual(data);
    });

    it('should handle older schema version', () => {
      const data = { schemaVersion: 0, bugs: [{ id: 1 }] };
      const result = migrateSchema(data);

      // Currently just passes through - future migrations would transform
      expect(result.bugs).toHaveLength(1);
    });
  });

  describe('downloadFile', () => {
    let createObjectURLMock;
    let revokeObjectURLMock;

    beforeEach(() => {
      createObjectURLMock = vi.fn().mockReturnValue('blob:test');
      revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create blob and trigger download', () => {
      // Mock document methods
      const clickMock = vi.fn();
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickMock,
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock);

      downloadFile('test content', 'test.json', 'application/json');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      const filename = generateFilename('export', 'json');

      expect(filename).toMatch(/^export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });

    it('should use provided prefix and extension', () => {
      const filename = generateFilename('bugs', 'csv');

      expect(filename).toContain('bugs-');
      expect(filename).toContain('.csv');
    });
  });

  describe('round-trip export/import', () => {
    it('should preserve bug data through export and import', () => {
      const originalBugs = createSampleBugs();
      const jsonStr = exportJSON(originalBugs, {
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'gemini',
      });
      const result = importJSON(jsonStr);

      expect(result.bugs[0].id).toBe(originalBugs[0].id);
      expect(result.bugs[0].summary).toBe(originalBugs[0].summary);
      expect(result.bugs[0].tags).toEqual(originalBugs[0].tags);
    });
  });
});
