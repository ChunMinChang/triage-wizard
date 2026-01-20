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
  updateConfig: vi.fn(() => ({ valid: true, errors: [] })),
  initializeWithBackendDetection: vi.fn(async () => ({
    backendDetected: false,
    defaultsApplied: false,
    availableProviders: [],
    recommendedProvider: null,
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
      <select id="ai-provider">
        <option value="none">None</option>
        <option value="gemini">Gemini</option>
        <option value="claude">Claude</option>
      </select>
      <select id="ai-transport">
        <option value="browser">Browser</option>
        <option value="backend">Backend</option>
      </select>
      <input id="bugzilla-host" value="https://bugzilla.mozilla.org" />
      <input id="bugzilla-api-key" value="" />
      <label id="ai-api-key-label"><input id="ai-api-key" value="" /></label>
      <label id="backend-url-label"><input id="backend-url" value="" /></label>
      <input id="ai-model" value="" list="ai-model-suggestions" />
      <datalist id="ai-model-suggestions">
        <option value="gemini-2.5-flash">
        <option value="gemini-2.5-pro">
        <option value="claude-sonnet-4">
        <option value="claude-opus-4">
      </datalist>
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

  describe('heuristics only mode', () => {
    const mockBug = {
      id: 999,
      summary: 'Test bug for heuristics',
      description: 'Test description',
      keywords: ['testcase'],
      cf_has_str: 'yes',
    };

    beforeEach(() => {
      // Configure as "none" provider (heuristics only)
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'none',
        aiTransport: 'browser',
        aiApiKey: '',
      });
      ai.isProviderConfigured.mockReturnValue(false);
      bugzilla.fetchAttachments.mockResolvedValue([]);
      bugzilla.fetchComments.mockResolvedValue([]);
    });

    it('should NOT set aiError when provider is "none"', async () => {
      const result = await processBug(mockBug, { runAi: true });

      // Should NOT have an AI error - user explicitly chose heuristics only
      expect(result.aiError).toBeUndefined();
    });

    it('should compute heuristic tags when provider is "none"', async () => {
      const result = await processBug(mockBug, { runAi: true });

      // Heuristic tags should still be computed
      expect(tags.computeHeuristicTags).toHaveBeenCalled();
      expect(result.tags).toBeDefined();
    });

    it('should calculate hasStrSuggested when provider is "none"', async () => {
      const result = await processBug(mockBug, { runAi: true });

      expect(tags.calculateHasStrSuggested).toHaveBeenCalled();
      expect(result.hasStrSuggested).toBeDefined();
    });

    it('should process all bugs successfully with heuristics only', async () => {
      const mockBugs = [
        { id: 1, summary: 'Bug 1', keywords: [] },
        { id: 2, summary: 'Bug 2', keywords: ['testcase'] },
      ];

      const processed = await processAllBugs(mockBugs, { runAi: true });

      // All bugs should be processed without errors
      expect(processed).toHaveLength(2);
      expect(processed[0].aiError).toBeUndefined();
      expect(processed[1].aiError).toBeUndefined();

      // Success message should be shown (not error)
      expect(ui.showSuccess).toHaveBeenCalledWith(expect.stringContaining('2 bugs'));
      expect(ui.showError).not.toHaveBeenCalled();
    });

    it('should fetch details when processing all bugs', async () => {
      const mockBugs = [{ id: 123, summary: 'Bug with details needed' }];

      await processAllBugs(mockBugs, { fetchDetails: true, runAi: true });

      // Should fetch attachments and comments for heuristic tag detection
      expect(bugzilla.fetchAttachments).toHaveBeenCalledWith(123);
      expect(bugzilla.fetchComments).toHaveBeenCalledWith(123);
    });
  });

  describe('AI provider configuration errors', () => {
    const mockBug = {
      id: 888,
      summary: 'Test bug',
      description: 'Test',
    };

    it('should show error when provider is selected but API key missing (browser mode)', async () => {
      // Provider selected but no API key
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'gemini',
        aiTransport: 'browser',
        aiApiKey: '', // Missing!
      });
      ai.isProviderConfigured.mockReturnValue(false);

      const result = await processBug(mockBug, { runAi: true });

      // SHOULD have an error because user selected a provider but didn't configure it
      expect(result.aiError).toBeDefined();
      expect(result.aiError).toContain('API key required');
    });

    it('should NOT show error when using backend transport without API key', async () => {
      // Backend mode doesn't need API key in frontend
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'claude',
        aiTransport: 'backend',
        aiApiKey: '',
        backendUrl: 'http://localhost:3000',
      });
      ai.isProviderConfigured.mockReturnValue(true);
      ai.classifyBug.mockResolvedValue({
        summary: 'Test summary',
        ai_detected_str: false,
        ai_detected_test_attached: false,
      });

      const result = await processBug(mockBug, { runAi: true });

      // Should work - backend handles auth
      expect(ai.classifyBug).toHaveBeenCalled();
    });
  });

  describe('AI failure handling', () => {
    const mockBug = {
      id: 777,
      summary: 'Test bug',
      keywords: ['testcase'],
    };

    it('should calculate hasStrSuggested even when AI fails', async () => {
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'claude',
        aiTransport: 'backend',
        backendUrl: 'http://localhost:3000',
      });
      ai.isProviderConfigured.mockReturnValue(true);
      ai.classifyBug.mockRejectedValue(new Error('Backend error'));

      const result = await processBug(mockBug, { runAi: true });

      // hasStrSuggested should still be calculated from heuristics
      expect(result.hasStrSuggested).toBeDefined();
      expect(result.aiError).toBeDefined();
      expect(tags.calculateHasStrSuggested).toHaveBeenCalled();
    });

    it('should clear previous aiError when reprocessing', async () => {
      // Bug with previous aiError from failed AI attempt
      const bugWithPreviousError = {
        ...mockBug,
        aiError: 'Previous error',
        aiSummary: 'Previous summary',
        aiAttempted: true,
      };

      // Now process with provider "none" (heuristics only)
      config.getConfig.mockReturnValue({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        aiProvider: 'none',
      });
      ai.isProviderConfigured.mockReturnValue(false);

      const result = await processBug(bugWithPreviousError, { runAi: true });

      // Previous AI state should be cleared
      expect(result.aiError).toBeUndefined();
      expect(result.aiSummary).toBeUndefined();
      expect(result.aiAttempted).toBeUndefined();
    });
  });

  describe('Gemini backend transport restriction', () => {
    beforeEach(() => {
      // Set up event listeners for the test
      setupEventListeners();
    });

    it('should disable backend option when Gemini is selected', () => {
      const providerSelect = document.getElementById('ai-provider');
      const transportSelect = document.getElementById('ai-transport');
      const backendOption = transportSelect.querySelector('option[value="backend"]');

      // Select Gemini
      providerSelect.value = 'gemini';
      providerSelect.dispatchEvent(new Event('change'));

      // Backend option should be disabled
      expect(backendOption.disabled).toBe(true);
    });

    it('should enable backend option when Claude is selected', () => {
      const providerSelect = document.getElementById('ai-provider');
      const transportSelect = document.getElementById('ai-transport');
      const backendOption = transportSelect.querySelector('option[value="backend"]');

      // Select Claude
      providerSelect.value = 'claude';
      providerSelect.dispatchEvent(new Event('change'));

      // Backend option should be enabled
      expect(backendOption.disabled).toBe(false);
    });

    it('should switch to browser when Gemini selected with backend transport', () => {
      const providerSelect = document.getElementById('ai-provider');
      const transportSelect = document.getElementById('ai-transport');

      // Start with Claude and backend
      providerSelect.value = 'claude';
      providerSelect.dispatchEvent(new Event('change'));
      transportSelect.value = 'backend';
      transportSelect.dispatchEvent(new Event('change'));

      // Now switch to Gemini
      providerSelect.value = 'gemini';
      providerSelect.dispatchEvent(new Event('change'));

      // Should auto-switch to browser since Gemini doesn't support backend
      expect(transportSelect.value).toBe('browser');
    });

    it('should only show Gemini models when Gemini is selected', () => {
      const providerSelect = document.getElementById('ai-provider');
      const datalist = document.getElementById('ai-model-suggestions');

      // Select Gemini
      providerSelect.value = 'gemini';
      providerSelect.dispatchEvent(new Event('change'));

      // Check model options
      const options = datalist.querySelectorAll('option');
      options.forEach((option) => {
        const isGemini = option.value.startsWith('gemini');
        if (isGemini) {
          expect(option.hasAttribute('hidden')).toBe(false);
          expect(option.disabled).toBe(false);
        } else {
          expect(option.hasAttribute('hidden')).toBe(true);
          expect(option.disabled).toBe(true);
        }
      });
    });

    it('should only show Claude models when Claude is selected', () => {
      const providerSelect = document.getElementById('ai-provider');
      const datalist = document.getElementById('ai-model-suggestions');

      // Select Claude
      providerSelect.value = 'claude';
      providerSelect.dispatchEvent(new Event('change'));

      // Check model options
      const options = datalist.querySelectorAll('option');
      options.forEach((option) => {
        const isClaude = option.value.startsWith('claude');
        if (isClaude) {
          expect(option.hasAttribute('hidden')).toBe(false);
          expect(option.disabled).toBe(false);
        } else {
          expect(option.hasAttribute('hidden')).toBe(true);
          expect(option.disabled).toBe(true);
        }
      });
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

  describe('handleRefineChipClick', () => {
    let handleRefineChipClick;

    beforeEach(async () => {
      // Import the actual function
      const appModule = await vi.importActual('../app.js');
      handleRefineChipClick = appModule.handleRefineChipClick;

      // Set up refine chips in DOM
      document.body.innerHTML = `
        <div class="refine-chips">
          <button type="button" class="chip" data-instruction="Make it shorter">Shorter</button>
          <button type="button" class="chip" data-instruction="Use a friendlier tone">Friendlier</button>
          <button type="button" class="chip" data-instruction="Add request for STR">+STR request</button>
        </div>
      `;
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should toggle selected class on chip click', () => {
      const chip = document.querySelector('.chip');
      const event = { target: chip };

      // First click - select
      handleRefineChipClick(event);
      expect(chip.classList.contains('selected')).toBe(true);

      // Second click - deselect
      handleRefineChipClick(event);
      expect(chip.classList.contains('selected')).toBe(false);
    });

    it('should allow multiple chips to be selected', () => {
      const chips = document.querySelectorAll('.chip');

      handleRefineChipClick({ target: chips[0] });
      handleRefineChipClick({ target: chips[1] });

      expect(chips[0].classList.contains('selected')).toBe(true);
      expect(chips[1].classList.contains('selected')).toBe(true);
      expect(chips[2].classList.contains('selected')).toBe(false);
    });

    it('should NOT trigger refine action on chip click', () => {
      // This is the key test - clicking a chip should only toggle, not refine
      const chip = document.querySelector('.chip');
      const event = { target: chip };

      // handleRefineChipClick should be synchronous and only toggle class
      const result = handleRefineChipClick(event);

      // Function should return undefined (not a Promise)
      expect(result).toBeUndefined();

      // Chip should be selected
      expect(chip.classList.contains('selected')).toBe(true);
    });

    it('should do nothing if click is not on a chip', () => {
      const container = document.querySelector('.refine-chips');
      const event = { target: container };

      handleRefineChipClick(event);

      // No chips should be selected
      const selected = document.querySelectorAll('.chip.selected');
      expect(selected).toHaveLength(0);
    });

    it('should do nothing if chip has no data-instruction', () => {
      const chip = document.querySelector('.chip');
      delete chip.dataset.instruction;
      const event = { target: chip };

      handleRefineChipClick(event);

      expect(chip.classList.contains('selected')).toBe(false);
    });
  });
});
