/**
 * @fileoverview Basic module import tests.
 * Verifies all modules can be imported without errors.
 */

import { describe, it, expect } from 'vitest';

describe('Module imports', () => {
  it('should import storage module', async () => {
    const storage = await import('../storage.js');
    expect(storage.getConfig).toBeDefined();
    expect(storage.setConfig).toBeDefined();
    expect(storage.getAllConfig).toBeDefined();
  });

  it('should import config module', async () => {
    const config = await import('../config.js');
    expect(config.DEFAULTS).toBeDefined();
    expect(config.getConfig).toBeDefined();
    expect(config.updateConfig).toBeDefined();
    expect(config.isValidUrl).toBeDefined();
  });

  it('should import bugzilla module', async () => {
    const bugzilla = await import('../bugzilla.js');
    expect(bugzilla.loadBugsByIds).toBeDefined();
    expect(bugzilla.loadBugsByRestUrl).toBeDefined();
    expect(bugzilla.parseBuglistUrl).toBeDefined();
    expect(bugzilla.fetchAttachments).toBeDefined();
    expect(bugzilla.fetchComments).toBeDefined();
  });

  it('should import tags module', async () => {
    const tags = await import('../tags.js');
    expect(tags.TAG_IDS).toBeDefined();
    expect(tags.computeHeuristicTags).toBeDefined();
    expect(tags.mergeAiTags).toBeDefined();
    expect(tags.calculateHasStrSuggested).toBeDefined();
  });

  it('should import filters module', async () => {
    const filters = await import('../filters.js');
    expect(filters.PRESETS).toBeDefined();
    expect(filters.filterByTags).toBeDefined();
    expect(filters.filterByTagDifference).toBeDefined();
    expect(filters.applyPreset).toBeDefined();
  });

  it('should import ui module', async () => {
    const ui = await import('../ui.js');
    expect(ui.renderBugTable).toBeDefined();
    expect(ui.renderTags).toBeDefined();
    expect(ui.setLoading).toBeDefined();
    expect(ui.showError).toBeDefined();
  });

  it('should import ai module', async () => {
    const ai = await import('../ai.js');
    expect(ai.classifyBug).toBeDefined();
    expect(ai.customizeCannedResponse).toBeDefined();
    expect(ai.suggestCannedResponse).toBeDefined();
    expect(ai.supportsBrowserMode).toBeDefined();
  });

  it('should import cannedResponses module', async () => {
    const cannedResponses = await import('../cannedResponses.js');
    expect(cannedResponses.parseCannedResponsesMarkdown).toBeDefined();
    expect(cannedResponses.loadDefaults).toBeDefined();
    expect(cannedResponses.getAll).toBeDefined();
    expect(cannedResponses.getById).toBeDefined();
  });

  it('should import exports module', async () => {
    const exports = await import('../exports.js');
    expect(exports.SCHEMA_VERSION).toBeDefined();
    expect(exports.exportJSON).toBeDefined();
    expect(exports.exportCSV).toBeDefined();
    expect(exports.exportMarkdown).toBeDefined();
    expect(exports.importJSON).toBeDefined();
  });

  it('should import app module', async () => {
    const app = await import('../app.js');
    expect(app.init).toBeDefined();
    expect(app.loadBugs).toBeDefined();
    expect(app.processBug).toBeDefined();
    expect(app.processAllBugs).toBeDefined();
  });
});

describe('Config validation', () => {
  it('should validate URLs correctly', async () => {
    const { isValidUrl } = await import('../config.js');

    expect(isValidUrl('https://bugzilla.mozilla.org')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('should have correct default values', async () => {
    const { DEFAULTS } = await import('../config.js');

    expect(DEFAULTS.bugzillaHost).toBe('https://bugzilla.mozilla.org');
    expect(DEFAULTS.aiProvider).toBe('gemini');
    expect(DEFAULTS.aiTransport).toBe('browser');
  });
});

describe('AI provider support', () => {
  it('should correctly identify browser-supported providers', async () => {
    const { supportsBrowserMode } = await import('../ai.js');

    expect(supportsBrowserMode('gemini')).toBe(true);
    expect(supportsBrowserMode('claude')).toBe(true);
    expect(supportsBrowserMode('openai')).toBe(false);
    expect(supportsBrowserMode('grok')).toBe(false);
  });
});

describe('Tag constants', () => {
  it('should have all required tag IDs', async () => {
    const { TAG_IDS, AI_ONLY_TAGS, NON_AI_TAGS } = await import('../tags.js');

    expect(TAG_IDS.HAS_STR).toBe('has-str');
    expect(TAG_IDS.TEST_ATTACHED).toBe('test-attached');
    expect(TAG_IDS.AI_DETECTED_STR).toBe('ai-detected-str');

    // test-attached must be non-AI only
    expect(NON_AI_TAGS).toContain(TAG_IDS.TEST_ATTACHED);

    // AI-detected tags must be AI-only
    expect(AI_ONLY_TAGS).toContain(TAG_IDS.AI_DETECTED_STR);
    expect(AI_ONLY_TAGS).toContain(TAG_IDS.AI_DETECTED_TEST_ATTACHED);
  });
});

describe('Export schema', () => {
  it('should have schema version defined', async () => {
    const { SCHEMA_VERSION } = await import('../exports.js');
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('should generate valid JSON export structure', async () => {
    const { exportJSON } = await import('../exports.js');

    const json = exportJSON([], { bugzillaHost: 'https://bugzilla.mozilla.org' });
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.generatedAt).toBeDefined();
    expect(parsed.bugs).toEqual([]);
  });
});
