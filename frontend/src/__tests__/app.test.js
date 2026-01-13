/**
 * @fileoverview Tests for app module (orchestration)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as bugzilla from '../bugzilla.js';
import * as ui from '../ui.js';
import * as config from '../config.js';

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
}));

vi.mock('../config.js', () => ({
  getConfig: vi.fn(() => ({
    bugzillaHost: 'https://bugzilla.mozilla.org',
    bugzillaApiKey: '',
    aiProvider: 'none',
  })),
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
});
