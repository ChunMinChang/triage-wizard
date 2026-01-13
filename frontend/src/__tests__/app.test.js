/**
 * @fileoverview Tests for app module (orchestration)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as bugzilla from '../bugzilla.js';
import * as ui from '../ui.js';
import * as config from '../config.js';
import * as tags from '../tags.js';
import * as ai from '../ai.js';

// Mock modules
vi.mock('../bugzilla.js', () => ({
  parseInputString: vi.fn(),
  loadBugsByIds: vi.fn(),
  loadBugsByRestUrl: vi.fn(),
  parseBuglistUrl: vi.fn(),
  fetchAttachments: vi.fn(),
  fetchComments: vi.fn(),
}));

vi.mock('../ui.js', () => ({
  renderBugTable: vi.fn(),
  setLoading: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
  clearBugTable: vi.fn(),
  updateFilterControls: vi.fn(),
  updateBugCount: vi.fn(),
}));

vi.mock('../config.js', () => ({
  getConfig: vi.fn(() => ({
    bugzillaHost: 'https://bugzilla.mozilla.org',
    bugzillaApiKey: '',
    aiProvider: 'none',
  })),
}));

vi.mock('../filters.js', async () => {
  const actual = await vi.importActual('../filters.js');
  return {
    ...actual,
    filterByTagDifference: vi.fn((bugs, include, exclude) => {
      // Use actual implementation for testing
      return actual.filterByTagDifference(bugs, include, exclude);
    }),
    getPreset: vi.fn((id) => actual.getPreset(id)),
    applyPreset: vi.fn((bugs, presetId) => actual.applyPreset(bugs, presetId)),
  };
});

vi.mock('../tags.js', async () => {
  const actual = await vi.importActual('../tags.js');
  return {
    ...actual,
    computeHeuristicTags: vi.fn((bug) => actual.computeHeuristicTags(bug)),
    mergeAiTags: vi.fn((tags, aiResult) => actual.mergeAiTags(tags, aiResult)),
    calculateHasStrSuggested: vi.fn((tags) => actual.calculateHasStrSuggested(tags)),
  };
});

vi.mock('../ai.js', () => ({
  isProviderConfigured: vi.fn(() => false),
  classifyBug: vi.fn(),
}));

// Import app after mocking dependencies
import {
  init,
  loadBugs,
  processBug,
  processAllBugs,
  getLoadedBugs,
  clearBugs,
  handleLoadClick,
  setupEventListeners,
  applyFilter,
  clearFilter,
  handlePresetChange,
} from '../app.js';

describe('app module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up DOM
    document.body.innerHTML = `
      <input id="bug-input-field" value="" />
      <button id="load-bugs-btn">Load Bugs</button>
      <button id="process-all-btn">Process All</button>
      <button id="apply-filter-btn">Apply Filter</button>
      <button id="clear-filter-btn">Clear</button>
      <button id="export-json-btn">Export JSON</button>
      <button id="export-csv-btn">Export CSV</button>
      <button id="export-md-btn">Export Markdown</button>
      <input id="import-json" type="file" />
      <select id="ai-provider"><option value="none">None</option></select>
      <input id="bugzilla-host" value="https://bugzilla.mozilla.org" />
      <input id="bugzilla-api-key" value="" />
      <input id="ai-api-key" value="" />
      <tbody id="bug-table-body"></tbody>
      <div id="include-tags"></div>
      <div id="exclude-tags"></div>
      <select id="filter-preset">
        <option value="">-- Preset filters --</option>
        <option value="fuzzing-testcase">Fuzzing testcase</option>
      </select>
    `;

    // Reset bugzilla mock implementations
    bugzilla.parseInputString.mockReturnValue({ type: 'ids', ids: [] });
    bugzilla.loadBugsByIds.mockResolvedValue([]);
    bugzilla.loadBugsByRestUrl.mockResolvedValue([]);
    bugzilla.parseBuglistUrl.mockReturnValue(null);
    bugzilla.fetchAttachments.mockResolvedValue([]);
    bugzilla.fetchComments.mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should set up event listeners', () => {
      init();

      const loadBtn = document.getElementById('load-bugs-btn');
      expect(loadBtn).not.toBeNull();
      // Event listeners are attached but hard to verify directly
    });

    it('should not throw if DOM elements are missing', () => {
      document.body.innerHTML = '';
      expect(() => init()).not.toThrow();
    });
  });

  describe('loadBugs', () => {
    const mockBugs = [
      { id: 123456, summary: 'Bug 1', status: 'NEW' },
      { id: 234567, summary: 'Bug 2', status: 'ASSIGNED' },
    ];

    it('should load bugs by IDs', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456', '234567'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      const bugs = await loadBugs('123456 234567');

      expect(bugzilla.loadBugsByIds).toHaveBeenCalledWith(['123456', '234567']);
      expect(bugs).toHaveLength(2);
    });

    it('should load bugs by REST URL', async () => {
      const restUrl = 'https://bugzilla.mozilla.org/rest/bug?product=Firefox';
      bugzilla.parseInputString.mockReturnValue({
        type: 'rest',
        url: restUrl,
      });
      bugzilla.loadBugsByRestUrl.mockResolvedValue(mockBugs);

      const bugs = await loadBugs(restUrl);

      expect(bugzilla.loadBugsByRestUrl).toHaveBeenCalledWith(restUrl);
      expect(bugs).toHaveLength(2);
    });

    it('should load bugs by buglist.cgi URL', async () => {
      const buglistUrl = 'https://bugzilla.mozilla.org/buglist.cgi?product=Firefox';
      const restUrl = 'https://bugzilla.mozilla.org/rest/bug?product=Firefox';

      bugzilla.parseInputString.mockReturnValue({
        type: 'buglist',
        url: buglistUrl,
      });
      bugzilla.parseBuglistUrl.mockReturnValue(restUrl);
      bugzilla.loadBugsByRestUrl.mockResolvedValue(mockBugs);

      const bugs = await loadBugs(buglistUrl);

      expect(bugzilla.parseBuglistUrl).toHaveBeenCalledWith(buglistUrl);
      expect(bugzilla.loadBugsByRestUrl).toHaveBeenCalledWith(restUrl);
      expect(bugs).toHaveLength(2);
    });

    it('should throw error for unparseable buglist URL', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'buglist',
        url: 'https://bugzilla.mozilla.org/buglist.cgi?complex_query',
      });
      bugzilla.parseBuglistUrl.mockReturnValue(null);

      await expect(loadBugs('buglist.cgi?complex_query')).rejects.toThrow();
    });

    it('should return empty array for empty input', async () => {
      bugzilla.parseInputString.mockReturnValue({ type: 'ids', ids: [] });

      const bugs = await loadBugs('');
      expect(bugs).toEqual([]);
    });

    it('should show loading state', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      await loadBugs('123456');

      expect(ui.setLoading).toHaveBeenCalledWith(true, expect.any(String));
      expect(ui.setLoading).toHaveBeenCalledWith(false);
    });

    it('should render bugs after loading', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      await loadBugs('123456');

      expect(ui.renderBugTable).toHaveBeenCalledWith(mockBugs, expect.any(Object));
    });

    it('should show error on network failure', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockRejectedValue(new Error('Network error'));

      await expect(loadBugs('123456')).rejects.toThrow('Network error');
      expect(ui.showError).toHaveBeenCalled();
    });

    it('should store loaded bugs', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      await loadBugs('123456');

      expect(getLoadedBugs()).toEqual(mockBugs);
    });
  });

  describe('processBug', () => {
    const mockBug = {
      id: 123456,
      summary: 'Test bug',
      status: 'NEW',
      keywords: [],
      cfHasStr: '',
      cfCrashSignature: '',
      flags: [],
    };

    it('should return bug with tags array', async () => {
      const processed = await processBug(mockBug);

      expect(processed).toHaveProperty('tags');
      expect(Array.isArray(processed.tags)).toBe(true);
    });

    it('should preserve original bug properties', async () => {
      const processed = await processBug(mockBug);

      expect(processed.id).toBe(123456);
      expect(processed.summary).toBe('Test bug');
      expect(processed.status).toBe('NEW');
    });

    it('should handle bug with existing tags', async () => {
      const bugWithTags = {
        ...mockBug,
        tags: [{ id: 'existing', label: 'Existing' }],
      };

      const processed = await processBug(bugWithTags);
      expect(processed.tags).toBeDefined();
    });

    it('should fetch attachments if requested', async () => {
      bugzilla.fetchAttachments.mockResolvedValue([
        { id: 1, file_name: 'test.html' },
      ]);

      const processed = await processBug(mockBug, { fetchDetails: true });

      expect(bugzilla.fetchAttachments).toHaveBeenCalledWith(mockBug.id);
      expect(processed.attachments).toBeDefined();
    });

    it('should fetch comments if requested', async () => {
      bugzilla.fetchComments.mockResolvedValue([
        { id: 1, text: 'Description', isDescription: true },
      ]);

      const processed = await processBug(mockBug, { fetchDetails: true });

      expect(bugzilla.fetchComments).toHaveBeenCalledWith(mockBug.id);
      expect(processed.comments).toBeDefined();
    });
  });

  describe('processAllBugs', () => {
    const mockBugs = [
      { id: 123456, summary: 'Bug 1', status: 'NEW', keywords: [], tags: [] },
      { id: 234567, summary: 'Bug 2', status: 'ASSIGNED', keywords: [], tags: [] },
    ];

    it('should process all bugs', async () => {
      const processed = await processAllBugs(mockBugs);

      expect(processed).toHaveLength(2);
      expect(processed[0]).toHaveProperty('tags');
      expect(processed[1]).toHaveProperty('tags');
    });

    it('should show loading state during processing', async () => {
      await processAllBugs(mockBugs);

      expect(ui.setLoading).toHaveBeenCalledWith(true, expect.any(String));
      expect(ui.setLoading).toHaveBeenCalledWith(false);
    });

    it('should update UI after processing', async () => {
      await processAllBugs(mockBugs);

      expect(ui.renderBugTable).toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      const processed = await processAllBugs([]);
      expect(processed).toEqual([]);
    });

    it('should show success message', async () => {
      await processAllBugs(mockBugs);

      expect(ui.showSuccess).toHaveBeenCalled();
    });
  });

  describe('getLoadedBugs', () => {
    it('should return empty array initially', () => {
      clearBugs();
      expect(getLoadedBugs()).toEqual([]);
    });

    it('should return loaded bugs after loadBugs', async () => {
      const mockBugs = [{ id: 123456, summary: 'Bug 1' }];
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      await loadBugs('123456');

      expect(getLoadedBugs()).toEqual(mockBugs);
    });
  });

  describe('clearBugs', () => {
    it('should clear loaded bugs', async () => {
      const mockBugs = [{ id: 123456, summary: 'Bug 1' }];
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      await loadBugs('123456');
      clearBugs();

      expect(getLoadedBugs()).toEqual([]);
    });

    it('should clear the UI table', () => {
      clearBugs();
      expect(ui.clearBugTable).toHaveBeenCalled();
    });
  });

  describe('handleLoadClick', () => {
    it('should read input from field and load bugs', async () => {
      const input = document.getElementById('bug-input-field');
      input.value = '123456 234567';

      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456', '234567'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue([
        { id: 123456, summary: 'Bug 1' },
      ]);

      await handleLoadClick();

      expect(bugzilla.parseInputString).toHaveBeenCalledWith('123456 234567');
    });

    it('should show info message for empty input', async () => {
      const input = document.getElementById('bug-input-field');
      input.value = '';

      await handleLoadClick();

      expect(ui.showInfo).toHaveBeenCalled();
    });

    it('should trim whitespace from input', async () => {
      const input = document.getElementById('bug-input-field');
      input.value = '  123456  ';

      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue([]);

      await handleLoadClick();

      expect(bugzilla.parseInputString).toHaveBeenCalledWith('123456');
    });
  });

  describe('setupEventListeners', () => {
    it('should attach click handler to load button', () => {
      const loadBtn = document.getElementById('load-bugs-btn');
      const addEventListenerSpy = vi.spyOn(loadBtn, 'addEventListener');

      setupEventListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should attach click handler to process all button', () => {
      const processBtn = document.getElementById('process-all-btn');
      const addEventListenerSpy = vi.spyOn(processBtn, 'addEventListener');

      setupEventListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should handle missing elements gracefully', () => {
      document.body.innerHTML = '';
      expect(() => setupEventListeners()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should show user-friendly error for network failures', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await loadBugs('123456');
      } catch (e) {
        // Expected
      }

      expect(ui.showError).toHaveBeenCalledWith(
        expect.stringContaining('fetch'),
        expect.any(Object)
      );
    });

    it('should show error for invalid bug IDs', async () => {
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockRejectedValue(
        new Error('Bugzilla API error: 404 Not Found')
      );

      try {
        await loadBugs('123456');
      } catch (e) {
        // Expected
      }

      expect(ui.showError).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should support full load workflow', async () => {
      const mockBugs = [
        { id: 123456, summary: 'Bug 1', status: 'NEW', keywords: [] },
      ];

      // Set up input
      const input = document.getElementById('bug-input-field');
      input.value = '123456';

      // Mock bugzilla responses
      bugzilla.parseInputString.mockReturnValue({
        type: 'ids',
        ids: ['123456'],
      });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugs);

      // Simulate click
      await handleLoadClick();

      // Verify full workflow
      expect(ui.setLoading).toHaveBeenCalledWith(true, expect.any(String));
      expect(bugzilla.loadBugsByIds).toHaveBeenCalled();
      expect(ui.renderBugTable).toHaveBeenCalledWith(mockBugs, expect.any(Object));
      expect(ui.setLoading).toHaveBeenCalledWith(false);
      expect(getLoadedBugs()).toEqual(mockBugs);
    });
  });

  describe('filtering', () => {
    const mockBugsWithTags = [
      {
        id: 1,
        summary: 'Bug with Has STR',
        tags: [{ id: 'has-str', label: 'Has STR' }],
      },
      {
        id: 2,
        summary: 'Bug with test-attached',
        tags: [{ id: 'test-attached', label: 'test-attached' }],
      },
      {
        id: 3,
        summary: 'Bug with fuzzy-test-attached',
        tags: [{ id: 'fuzzy-test-attached', label: 'fuzzy-test-attached' }],
      },
    ];

    beforeEach(() => {
      // Load bugs first
      bugzilla.parseInputString.mockReturnValue({ type: 'ids', ids: ['1', '2', '3'] });
      bugzilla.loadBugsByIds.mockResolvedValue(mockBugsWithTags);
    });

    it('should filter bugs by include tags', async () => {
      await loadBugs('1 2 3');

      // Apply filter with include tags
      applyFilter({ include: ['has-str'], exclude: [] });

      expect(ui.renderBugTable).toHaveBeenCalled();
      const lastCall = ui.renderBugTable.mock.calls[ui.renderBugTable.mock.calls.length - 1];
      const filteredBugs = lastCall[0];
      expect(filteredBugs.length).toBe(1);
      expect(filteredBugs[0].id).toBe(1);
    });

    it('should filter bugs by exclude tags', async () => {
      await loadBugs('1 2 3');

      // Apply filter with exclude tags
      applyFilter({ include: [], exclude: ['has-str'] });

      const lastCall = ui.renderBugTable.mock.calls[ui.renderBugTable.mock.calls.length - 1];
      const filteredBugs = lastCall[0];
      expect(filteredBugs.length).toBe(2);
      expect(filteredBugs.map((b) => b.id)).toEqual([2, 3]);
    });

    it('should clear filter and show all bugs', async () => {
      await loadBugs('1 2 3');

      // Apply filter first
      applyFilter({ include: ['has-str'], exclude: [] });

      // Now clear
      clearFilter();

      const lastCall = ui.renderBugTable.mock.calls[ui.renderBugTable.mock.calls.length - 1];
      const bugs = lastCall[0];
      expect(bugs.length).toBe(3);
    });

    it('should apply preset filter', async () => {
      await loadBugs('1 2 3');

      // Select preset
      const presetSelect = document.getElementById('filter-preset');
      presetSelect.value = 'fuzzing-testcase';

      handlePresetChange();

      const lastCall = ui.renderBugTable.mock.calls[ui.renderBugTable.mock.calls.length - 1];
      const filteredBugs = lastCall[0];
      expect(filteredBugs.length).toBe(1);
      expect(filteredBugs[0].id).toBe(3);
    });

    it('should update bug count when filtered', async () => {
      await loadBugs('1 2 3');

      // Apply filter with test-attached
      applyFilter({ include: ['test-attached'], exclude: [] });

      // Should show filtered count
      expect(ui.updateBugCount).toHaveBeenCalled();
      // Get the last call to updateBugCount
      const calls = ui.updateBugCount.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(1); // Only bug 2 has test-attached
    });
  });

  describe('AI integration (L3-F4)', () => {
    const mockBugWithStr = {
      id: 1001,
      summary: 'Test bug',
      description: 'Steps to reproduce: 1. Open browser 2. Click button 3. See crash',
      cf_has_str: 'no',
    };

    beforeEach(() => {
      bugzilla.parseInputString.mockReturnValue({ type: 'ids', ids: ['1001'] });
      bugzilla.loadBugsByIds.mockResolvedValue([mockBugWithStr]);
      bugzilla.fetchAttachments.mockResolvedValue([]);
      bugzilla.fetchComments.mockResolvedValue([]);
    });

    it('should compute heuristic tags when processing bug', async () => {
      await loadBugs('1001');

      const result = await processBug(mockBugWithStr, {});

      // Should have called computeHeuristicTags
      expect(tags.computeHeuristicTags).toHaveBeenCalledWith(expect.objectContaining({ id: 1001 }));
      expect(tags.calculateHasStrSuggested).toHaveBeenCalled();
    });

    it('should not run AI classification when provider is not configured', async () => {
      ai.isProviderConfigured.mockReturnValue(false);

      await loadBugs('1001');
      await processBug(mockBugWithStr, { runAi: true });

      // AI should not be called
      expect(ai.classifyBug).not.toHaveBeenCalled();
    });

    it('should run AI classification when provider is configured', async () => {
      // Configure AI provider
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'gemini',
        aiTransport: 'browser',
        aiApiKey: 'test-key',
      });
      ai.isProviderConfigured.mockReturnValue(true);
      ai.classifyBug.mockResolvedValue({
        ai_detected_str: true,
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: false,
        summary: 'Bug has clear STR',
      });

      const result = await processBug(mockBugWithStr, { runAi: true });

      // AI should have been called
      expect(ai.classifyBug).toHaveBeenCalled();
      expect(tags.mergeAiTags).toHaveBeenCalled();
      expect(result.aiSummary).toBe('Bug has clear STR');
    });

    it('should calculate hasStrSuggested after processing', async () => {
      const result = await processBug(mockBugWithStr, {});

      expect(tags.calculateHasStrSuggested).toHaveBeenCalled();
      expect(result.hasStrSuggested).toBeDefined();
    });

    it('should handle AI classification failure gracefully', async () => {
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'gemini',
        aiApiKey: 'test-key',
      });
      ai.isProviderConfigured.mockReturnValue(true);
      ai.classifyBug.mockRejectedValue(new Error('API error'));

      // Should not throw, should continue with heuristic tags
      const result = await processBug(mockBugWithStr, { runAi: true });

      expect(result).toBeDefined();
      expect(tags.computeHeuristicTags).toHaveBeenCalled();
    });
  });
});
