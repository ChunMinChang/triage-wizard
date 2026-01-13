/**
 * @fileoverview Main application orchestration module.
 *
 * Responsibilities:
 * - Wire UI event handlers
 * - Orchestrate bug loading, processing, and exports
 * - Coordinate between modules (bugzilla, ai, tags, ui, filters)
 *
 * @module app
 */

import * as bugzilla from './bugzilla.js';
import * as ui from './ui.js';
import * as config from './config.js';
import * as filters from './filters.js';
import * as tags from './tags.js';
import * as ai from './ai.js';
import * as cannedResponses from './cannedResponses.js';
import * as exports from './exports.js';

/** @type {Object[]} Currently loaded bugs */
let loadedBugs = [];

/** @type {Object} Current filter state */
let currentFilter = { include: [], exclude: [] };

/** DOM element IDs used by this module */
const DOM_IDS = {
  BUG_INPUT: 'bug-input-field',
  LOAD_BTN: 'load-bugs-btn',
  PROCESS_ALL_BTN: 'process-all-btn',
  APPLY_FILTER_BTN: 'apply-filter-btn',
  CLEAR_FILTER_BTN: 'clear-filter-btn',
  FILTER_PRESET: 'filter-preset',
  INCLUDE_TAGS: 'include-tags',
  EXCLUDE_TAGS: 'exclude-tags',
  EXPORT_JSON_BTN: 'export-json-btn',
  EXPORT_CSV_BTN: 'export-csv-btn',
  EXPORT_MD_BTN: 'export-md-btn',
  IMPORT_JSON: 'import-json',
  IMPORT_CANNED_MD: 'import-canned-md',
  IMPORT_REPLACE: 'import-replace',
  CANNED_CATEGORY_FILTER: 'canned-category-filter',
  CANNED_RESPONSES_LIST: 'canned-responses-list',
  RESPONSE_COMPOSER_MODAL: 'response-composer-modal',
  CLOSE_COMPOSER_BTN: 'close-composer-btn',
  CANNED_RESPONSE_SELECT: 'canned-response-select',
  RESPONSE_BODY: 'response-body',
  COPY_RESPONSE_BTN: 'copy-response-btn',
  POST_RESPONSE_BTN: 'post-response-btn',
  AI_CUSTOMIZE_BTN: 'ai-customize-btn',
  AI_SUGGEST_BTN: 'ai-suggest-btn',
  AI_GENERATE_BTN: 'ai-generate-btn',
  REFINE_INSTRUCTION: 'refine-instruction',
  REFINE_BTN: 'refine-btn',
  REFINE_CHIPS: 'refine-chips',
};

/**
 * Get a DOM element by ID with null check.
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function getElement(id) {
  return document.getElementById(id);
}

/**
 * Initialize the application.
 * Sets up event handlers and loads initial state.
 */
export async function init() {
  console.log('[app] Initializing application...');
  setupEventListeners();

  // Load default canned responses
  try {
    await cannedResponses.loadDefaults();
    refreshCannedResponsesUI();
    console.log('[app] Loaded default canned responses');
  } catch (err) {
    console.warn('[app] Failed to load default canned responses:', err);
  }
}

/**
 * Set up event listeners for UI controls.
 */
export function setupEventListeners() {
  // Load bugs button
  const loadBtn = getElement(DOM_IDS.LOAD_BTN);
  if (loadBtn) {
    loadBtn.addEventListener('click', handleLoadClick);
  }

  // Process all button
  const processAllBtn = getElement(DOM_IDS.PROCESS_ALL_BTN);
  if (processAllBtn) {
    processAllBtn.addEventListener('click', handleProcessAllClick);
  }

  // Filter buttons
  const applyFilterBtn = getElement(DOM_IDS.APPLY_FILTER_BTN);
  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', handleApplyFilter);
  }

  const clearFilterBtn = getElement(DOM_IDS.CLEAR_FILTER_BTN);
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', handleClearFilter);
  }

  // Filter preset dropdown
  const filterPreset = getElement(DOM_IDS.FILTER_PRESET);
  if (filterPreset) {
    filterPreset.addEventListener('change', handlePresetChange);
  }

  // Export buttons
  const exportJsonBtn = getElement(DOM_IDS.EXPORT_JSON_BTN);
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', handleExportJson);
  }

  const exportCsvBtn = getElement(DOM_IDS.EXPORT_CSV_BTN);
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', handleExportCsv);
  }

  const exportMdBtn = getElement(DOM_IDS.EXPORT_MD_BTN);
  if (exportMdBtn) {
    exportMdBtn.addEventListener('click', handleExportMarkdown);
  }

  // Import JSON
  const importJson = getElement(DOM_IDS.IMPORT_JSON);
  if (importJson) {
    importJson.addEventListener('change', handleImportJson);
  }

  // Table action delegation
  const tableBody = getElement('bug-table-body');
  if (tableBody) {
    tableBody.addEventListener('click', handleTableAction);
  }

  // Canned responses import
  const importCannedMd = getElement(DOM_IDS.IMPORT_CANNED_MD);
  if (importCannedMd) {
    importCannedMd.addEventListener('change', handleImportCannedMd);
  }

  // Canned responses category filter
  const cannedCategoryFilter = getElement(DOM_IDS.CANNED_CATEGORY_FILTER);
  if (cannedCategoryFilter) {
    cannedCategoryFilter.addEventListener('change', handleCannedCategoryFilter);
  }

  // Canned responses list actions (delegation)
  const cannedList = getElement(DOM_IDS.CANNED_RESPONSES_LIST);
  if (cannedList) {
    cannedList.addEventListener('click', handleCannedResponseAction);
  }

  // Response composer modal events
  const closeComposerBtn = getElement(DOM_IDS.CLOSE_COMPOSER_BTN);
  if (closeComposerBtn) {
    closeComposerBtn.addEventListener('click', handleCloseComposer);
  }

  const cannedResponseSelect = getElement(DOM_IDS.CANNED_RESPONSE_SELECT);
  if (cannedResponseSelect) {
    cannedResponseSelect.addEventListener('change', handleCannedResponseSelect);
  }

  const copyResponseBtn = getElement(DOM_IDS.COPY_RESPONSE_BTN);
  if (copyResponseBtn) {
    copyResponseBtn.addEventListener('click', handleCopyResponse);
  }

  const postResponseBtn = getElement(DOM_IDS.POST_RESPONSE_BTN);
  if (postResponseBtn) {
    postResponseBtn.addEventListener('click', handlePostResponse);
  }

  const aiCustomizeBtn = getElement(DOM_IDS.AI_CUSTOMIZE_BTN);
  if (aiCustomizeBtn) {
    aiCustomizeBtn.addEventListener('click', handleAiCustomize);
  }

  const aiSuggestBtn = getElement(DOM_IDS.AI_SUGGEST_BTN);
  if (aiSuggestBtn) {
    aiSuggestBtn.addEventListener('click', handleAiSuggest);
  }

  // AI Generate button
  const aiGenerateBtn = getElement(DOM_IDS.AI_GENERATE_BTN);
  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener('click', handleAiGenerate);
  }

  // Refine button
  const refineBtn = getElement(DOM_IDS.REFINE_BTN);
  if (refineBtn) {
    refineBtn.addEventListener('click', handleRefine);
  }

  // Refine instruction - handle Enter key
  const refineInstruction = getElement(DOM_IDS.REFINE_INSTRUCTION);
  if (refineInstruction) {
    refineInstruction.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRefine();
      }
    });
  }

  // Refine chips (delegation)
  const refineChips = document.querySelector('.refine-chips');
  if (refineChips) {
    refineChips.addEventListener('click', handleRefineChipClick);
  }

  // Close modal on backdrop click
  const composerModal = getElement(DOM_IDS.RESPONSE_COMPOSER_MODAL);
  if (composerModal) {
    composerModal.addEventListener('click', (e) => {
      if (e.target === composerModal) {
        handleCloseComposer();
      }
    });
  }
}

/**
 * Handle load bugs button click.
 */
export async function handleLoadClick() {
  const input = getElement(DOM_IDS.BUG_INPUT);
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    ui.showInfo('Please enter bug IDs or a Bugzilla URL');
    return;
  }

  try {
    await loadBugs(value);
  } catch (error) {
    // Error already shown by loadBugs
    console.error('[app] Load failed:', error);
  }
}

/**
 * Load bugs from the given input (IDs, REST URL, or buglist.cgi URL).
 * @param {string} input - User input containing bug IDs or URL
 * @returns {Promise<Object[]>} Array of loaded bug objects
 */
export async function loadBugs(input) {
  const parsed = bugzilla.parseInputString(input);

  // Handle empty input
  if (parsed.type === 'ids' && parsed.ids.length === 0) {
    return [];
  }

  ui.setLoading(true, 'Loading bugs...');

  try {
    let bugs = [];
    const cfg = config.getConfig();

    if (parsed.type === 'ids') {
      bugs = await bugzilla.loadBugsByIds(parsed.ids);
    } else if (parsed.type === 'rest') {
      bugs = await bugzilla.loadBugsByRestUrl(parsed.url);
    } else if (parsed.type === 'buglist') {
      const restUrl = bugzilla.parseBuglistUrl(parsed.url);
      if (!restUrl) {
        throw new Error('Could not parse buglist.cgi URL. Try using a REST URL instead.');
      }
      bugs = await bugzilla.loadBugsByRestUrl(restUrl);
    }

    // Store loaded bugs
    loadedBugs = bugs;

    // Render table
    ui.renderBugTable(bugs, { bugzillaHost: cfg.bugzillaHost });

    // Update filter controls with available tags
    const availableTags = collectAvailableTags(bugs);
    ui.updateFilterControls(availableTags, {});

    return bugs;
  } catch (error) {
    ui.showError(error.message, {});
    throw error;
  } finally {
    ui.setLoading(false);
  }
}

/**
 * Process a single bug (compute tags, optionally fetch details).
 * @param {Object} bug - Bug object to process
 * @param {Object} [options] - Processing options
 * @param {boolean} [options.fetchDetails] - Whether to fetch attachments and comments
 * @param {boolean} [options.runAi] - Whether to run AI classification
 * @returns {Promise<Object>} Processed bug with tags
 */
export async function processBug(bug, options = {}) {
  const processed = { ...bug };

  // Ensure tags array exists
  if (!processed.tags) {
    processed.tags = [];
  }

  // Fetch details if requested
  if (options.fetchDetails) {
    try {
      processed.attachments = await bugzilla.fetchAttachments(bug.id);
    } catch (error) {
      console.warn('[app] Failed to fetch attachments:', error);
      processed.attachments = [];
    }

    try {
      processed.comments = await bugzilla.fetchComments(bug.id);
    } catch (error) {
      console.warn('[app] Failed to fetch comments:', error);
      processed.comments = [];
    }
  }

  // Compute heuristic tags
  processed.tags = tags.computeHeuristicTags(processed);

  // Run AI classification if configured and requested
  const cfg = config.getConfig();
  const aiConfig = {
    provider: cfg.aiProvider,
    transport: cfg.aiTransport || 'browser',
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
  };

  if (options.runAi && ai.isProviderConfigured(aiConfig)) {
    try {
      const aiResult = await ai.classifyBug(processed, aiConfig);

      // Merge AI tags with heuristic tags (enforces semantic rules)
      processed.tags = tags.mergeAiTags(processed.tags, aiResult);

      // Store AI summary
      processed.aiSummary = aiResult.summary;

      // Calculate hasStrSuggested
      processed.hasStrSuggested = tags.calculateHasStrSuggested(processed.tags);
    } catch (error) {
      console.warn('[app] AI classification failed:', error);
      // Continue without AI tags - heuristics still available
    }
  } else {
    // Calculate hasStrSuggested with heuristic tags only
    processed.hasStrSuggested = tags.calculateHasStrSuggested(processed.tags);
  }

  return processed;
}

/**
 * Process all loaded bugs.
 * @param {Object[]} bugs - Array of bugs to process
 * @param {Object} [options] - Processing options
 * @returns {Promise<Object[]>} Array of processed bugs
 */
export async function processAllBugs(bugs, options = {}) {
  if (!bugs || bugs.length === 0) {
    return [];
  }

  ui.setLoading(true, `Processing ${bugs.length} bugs...`);

  try {
    const processed = [];
    for (const bug of bugs) {
      const result = await processBug(bug, options);
      processed.push(result);
    }

    // Update stored bugs
    loadedBugs = processed;

    // Re-render table
    const cfg = config.getConfig();
    ui.renderBugTable(processed, { bugzillaHost: cfg.bugzillaHost });

    // Update filter controls
    const availableTags = collectAvailableTags(processed);
    ui.updateFilterControls(availableTags, {});

    ui.showSuccess(`Processed ${processed.length} bugs`);

    return processed;
  } finally {
    ui.setLoading(false);
  }
}

/**
 * Get currently loaded bugs.
 * @returns {Object[]} Array of loaded bug objects
 */
export function getLoadedBugs() {
  return loadedBugs;
}

/**
 * Clear all loaded bugs.
 */
export function clearBugs() {
  loadedBugs = [];
  ui.clearBugTable();
}

/**
 * Collect all unique tag IDs from bugs.
 * @param {Object[]} bugs - Array of bugs
 * @returns {string[]} Array of unique tag IDs
 */
function collectAvailableTags(bugs) {
  const tagSet = new Set();
  bugs.forEach((bug) => {
    if (bug.tags && Array.isArray(bug.tags)) {
      bug.tags.forEach((tag) => {
        tagSet.add(tag.id);
      });
    }
  });
  return Array.from(tagSet).sort();
}

/**
 * Handle process all button click.
 */
async function handleProcessAllClick() {
  if (loadedBugs.length === 0) {
    ui.showInfo('No bugs loaded. Load bugs first.');
    return;
  }

  try {
    // Process all bugs with AI classification if configured
    await processAllBugs(loadedBugs, { runAi: true });
  } catch (error) {
    ui.showError('Failed to process bugs: ' + error.message);
  }
}

/**
 * Handle apply filter button click.
 */
function handleApplyFilter() {
  // Read from checkboxes when user clicks the button
  currentFilter = getSelectedTags();
  applyFilter();
}

/**
 * Handle clear filter button click.
 */
function handleClearFilter() {
  clearFilter();
}

/**
 * Handle preset dropdown change.
 */
export function handlePresetChange() {
  const presetSelect = getElement(DOM_IDS.FILTER_PRESET);
  if (!presetSelect) return;

  const presetId = presetSelect.value;
  if (!presetId) {
    // Empty selection - don't change anything
    return;
  }

  const preset = filters.getPreset(presetId);
  if (!preset) {
    console.warn('[app] Unknown preset:', presetId);
    return;
  }

  // Update current filter with preset values
  currentFilter = {
    include: [...preset.include],
    exclude: [...preset.exclude],
  };

  // Update UI checkboxes to match preset
  updateFilterCheckboxes();

  // Apply the filter
  applyFilter();
}

/**
 * Update filter checkboxes to match current filter state.
 */
function updateFilterCheckboxes() {
  const includeContainer = getElement(DOM_IDS.INCLUDE_TAGS);
  const excludeContainer = getElement(DOM_IDS.EXCLUDE_TAGS);

  if (includeContainer) {
    const checkboxes = includeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.checked = currentFilter.include.includes(cb.value);
    });
  }

  if (excludeContainer) {
    const checkboxes = excludeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.checked = currentFilter.exclude.includes(cb.value);
    });
  }
}

/**
 * Get selected tags from checkbox containers.
 * @returns {Object} Object with include and exclude arrays
 */
function getSelectedTags() {
  const include = [];
  const exclude = [];

  const includeContainer = getElement(DOM_IDS.INCLUDE_TAGS);
  if (includeContainer) {
    const checked = includeContainer.querySelectorAll('input[type="checkbox"]:checked');
    checked.forEach((cb) => include.push(cb.value));
  }

  const excludeContainer = getElement(DOM_IDS.EXCLUDE_TAGS);
  if (excludeContainer) {
    const checked = excludeContainer.querySelectorAll('input[type="checkbox"]:checked');
    checked.forEach((cb) => exclude.push(cb.value));
  }

  return { include, exclude };
}

/**
 * Apply filter to loaded bugs and render.
 * @param {Object} [filter] - Optional filter to apply. If not provided, uses currentFilter state.
 * @param {string[]} [filter.include] - Tags to include
 * @param {string[]} [filter.exclude] - Tags to exclude
 */
export function applyFilter(filter = null) {
  // Use provided filter or current state
  if (filter) {
    currentFilter = filter;
  }

  // Filter bugs
  const filteredBugs = filters.filterByTagDifference(
    loadedBugs,
    currentFilter.include,
    currentFilter.exclude
  );

  // Render filtered results
  const cfg = config.getConfig();
  ui.renderBugTable(filteredBugs, { bugzillaHost: cfg.bugzillaHost });

  // Update bug count
  ui.updateBugCount(filteredBugs.length);

  // Update filter controls UI
  ui.updateFilterControls(collectAvailableTags(loadedBugs), currentFilter);
}

/**
 * Clear filter and show all bugs.
 */
export function clearFilter() {
  // Reset filter state
  currentFilter = { include: [], exclude: [] };

  // Reset preset dropdown
  const presetSelect = getElement(DOM_IDS.FILTER_PRESET);
  if (presetSelect) {
    presetSelect.value = '';
  }

  // Uncheck all checkboxes
  updateFilterCheckboxes();

  // Render all bugs
  const cfg = config.getConfig();
  ui.renderBugTable(loadedBugs, { bugzillaHost: cfg.bugzillaHost });

  // Update bug count
  ui.updateBugCount(loadedBugs.length);

  // Update filter controls UI
  ui.updateFilterControls(collectAvailableTags(loadedBugs), currentFilter);
}

/**
 * Handle export JSON button click.
 */
function handleExportJson() {
  if (loadedBugs.length === 0) {
    ui.showInfo('No bugs to export');
    return;
  }

  const cfg = config.getConfig();
  const metadata = {
    bugzillaHost: cfg.bugzillaHost,
    input: { bugCount: loadedBugs.length },
    aiProvider: cfg.aiProvider,
    aiModel: cfg.aiModel,
    aiTransport: cfg.aiTransport,
  };

  const jsonContent = exports.exportJSON(loadedBugs, metadata);
  const filename = exports.generateFilename('triage-export', 'json');

  exports.downloadFile(jsonContent, filename, 'application/json');
  ui.showSuccess(`Exported ${loadedBugs.length} bugs to ${filename}`);
}

/**
 * Handle export CSV button click.
 */
function handleExportCsv() {
  if (loadedBugs.length === 0) {
    ui.showInfo('No bugs to export');
    return;
  }

  const cfg = config.getConfig();
  const csvContent = exports.exportCSV(loadedBugs, { bugzillaHost: cfg.bugzillaHost });
  const filename = exports.generateFilename('triage-export', 'csv');

  exports.downloadFile(csvContent, filename, 'text/csv');
  ui.showSuccess(`Exported ${loadedBugs.length} bugs to ${filename}`);
}

/**
 * Handle export Markdown button click.
 */
function handleExportMarkdown() {
  if (loadedBugs.length === 0) {
    ui.showInfo('No bugs to export');
    return;
  }

  const cfg = config.getConfig();
  const mdContent = exports.exportMarkdown(loadedBugs, { bugzillaHost: cfg.bugzillaHost });
  const filename = exports.generateFilename('triage-export', 'md');

  exports.downloadFile(mdContent, filename, 'text/markdown');
  ui.showSuccess(`Exported ${loadedBugs.length} bugs to ${filename}`);
}

/**
 * Handle import JSON file change.
 * @param {Event} event - File input change event
 */
async function handleImportJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const result = exports.importJSON(text);

    if (result.errors && result.errors.length > 0) {
      ui.showError(`Import failed: ${result.errors.join(', ')}`);
      return;
    }

    if (!result.bugs || result.bugs.length === 0) {
      ui.showInfo('No bugs found in import file');
      return;
    }

    // Update loaded bugs
    loadedBugs = result.bugs;

    // Render table
    const cfg = config.getConfig();
    ui.renderBugTable(loadedBugs, { bugzillaHost: cfg.bugzillaHost });

    // Update filter controls
    const availableTags = collectAvailableTags(loadedBugs);
    ui.updateFilterControls(availableTags, {});

    ui.showSuccess(`Imported ${result.bugs.length} bugs from ${file.name}`);
  } catch (err) {
    ui.showError(`Failed to import: ${err.message}`);
  }

  // Reset file input
  event.target.value = '';
}

/**
 * Handle table action button clicks (delegation).
 * @param {Event} event - Click event
 */
function handleTableAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const bugId = btn.dataset.bugId;

  if (action === 'process') {
    handleProcessSingleBug(bugId);
  } else if (action === 'toggle-summary') {
    handleToggleSummary(bugId);
  } else if (action === 'compose') {
    handleComposeBug(bugId);
  } else if (action === 'set-has-str') {
    handleSetHasStr(bugId);
  }
}

/**
 * Handle process single bug action.
 * @param {string} bugId - Bug ID
 */
async function handleProcessSingleBug(bugId) {
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError(`Bug ${bugId} not found`);
    return;
  }

  ui.setLoading(true, `Processing bug ${bugId}...`);

  try {
    const processed = await processBug(bug, { fetchDetails: true, runAi: true });

    // Update in loaded bugs array
    const index = loadedBugs.findIndex((b) => String(b.id) === String(bugId));
    if (index !== -1) {
      loadedBugs[index] = processed;
    }

    // Re-render table
    const cfg = config.getConfig();
    ui.renderBugTable(loadedBugs, { bugzillaHost: cfg.bugzillaHost });

    ui.showSuccess(`Processed bug ${bugId}`);
  } catch (error) {
    ui.showError(`Failed to process bug ${bugId}: ${error.message}`);
  } finally {
    ui.setLoading(false);
  }
}

/**
 * Handle toggle summary action.
 * @param {string} bugId - Bug ID
 */
function handleToggleSummary(bugId) {
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) return;

  // Use AI summary if available, otherwise placeholder
  const summary = bug.aiSummary || 'No AI summary available. Click "Process" to generate one.';
  ui.toggleSummary(bugId, summary);
}

/**
 * Handle set Has STR action.
 * @param {string} bugId - Bug ID
 */
async function handleSetHasStr(bugId) {
  const cfg = config.getConfig();

  if (!cfg.bugzillaApiKey) {
    ui.showError('Bugzilla API key required. Please configure in Settings.');
    return;
  }

  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError(`Bug ${bugId} not found`);
    return;
  }

  // Check if already has STR
  if (bug.cfHasStr === 'yes') {
    ui.showInfo(`Bug ${bugId} already has "Has STR" set`);
    return;
  }

  ui.setLoading(true, `Setting Has STR on bug ${bugId}...`);

  try {
    const success = await bugzilla.setHasStr(bugId, cfg.bugzillaApiKey);

    if (success) {
      // Update local bug state
      bug.cfHasStr = 'yes';

      // Remove hasStrSuggested since it's now set
      bug.hasStrSuggested = false;

      // Update the has-str tag if not present
      const hasStrTag = bug.tags?.find((t) => t.id === 'has-str');
      if (!hasStrTag) {
        bug.tags = bug.tags || [];
        bug.tags.push({
          id: 'has-str',
          label: 'Has STR',
          source: 'field',
          evidence: 'cf_has_str = yes (set via triage wizard)',
        });
      }

      // Re-render the table to reflect changes
      ui.renderBugTable(loadedBugs, { bugzillaHost: cfg.bugzillaHost });

      ui.showSuccess(`Set "Has STR" on bug ${bugId}`);
    } else {
      ui.showError(`Failed to set "Has STR" on bug ${bugId}`);
    }
  } catch (error) {
    ui.showError(`Error setting "Has STR": ${error.message}`);
  } finally {
    ui.setLoading(false);
  }
}

/**
 * Handle compose button click for a bug.
 * @param {string} bugId - Bug ID
 */
function handleComposeBug(bugId) {
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError(`Bug ${bugId} not found`);
    return;
  }

  const responses = cannedResponses.getAll();
  ui.openResponseComposer(bug, responses);
}

/**
 * Handle close composer button click.
 */
export function handleCloseComposer() {
  ui.closeResponseComposer();
}

/**
 * Handle canned response select change.
 * @param {Event} event - Change event
 */
export function handleCannedResponseSelect(event) {
  const responseId = event.target.value;
  if (!responseId) {
    ui.setComposerResponseBody('');
    return;
  }

  const response = cannedResponses.getById(responseId);
  if (response) {
    ui.setComposerResponseBody(response.bodyTemplate);
  }
}

/**
 * Handle copy response button click.
 */
export async function handleCopyResponse() {
  const body = ui.getComposerResponseBody();
  if (!body) {
    ui.showInfo('No response text to copy');
    return;
  }

  try {
    await navigator.clipboard.writeText(body);
    ui.showSuccess('Copied to clipboard');
  } catch (err) {
    ui.showError('Failed to copy to clipboard');
  }
}

/**
 * Handle post response button click.
 */
export async function handlePostResponse() {
  const bugId = ui.getComposerBugId();
  const body = ui.getComposerResponseBody();

  if (!bugId) {
    ui.showError('No bug selected');
    return;
  }

  if (!body.trim()) {
    ui.showInfo('Please enter a response');
    return;
  }

  const cfg = config.getConfig();

  if (!cfg.bugzillaApiKey) {
    ui.showError('Bugzilla API key required. Please configure in Settings.');
    return;
  }

  // Disable button and show loading
  const postBtn = getElement(DOM_IDS.POST_RESPONSE_BTN);
  if (postBtn) {
    postBtn.disabled = true;
    postBtn.textContent = 'Posting...';
  }

  try {
    const success = await bugzilla.postComment(bugId, body.trim(), cfg.bugzillaApiKey);

    if (success) {
      ui.showSuccess(`Comment posted to bug ${bugId}`);

      // Close the composer modal
      ui.closeResponseComposer();

      // Update local bug state to reflect new comment
      const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
      if (bug) {
        // Add a placeholder comment (actual content will be fetched on next load)
        bug.comments = bug.comments || [];
        bug.comments.push({
          text: body.trim(),
          author: 'You',
          creation_time: new Date().toISOString(),
          isDescription: false,
        });
      }
    } else {
      ui.showError(`Failed to post comment to bug ${bugId}`);
    }
  } catch (error) {
    ui.showError(`Error posting comment: ${error.message}`);
    console.error('[app] Post comment error:', error);
  } finally {
    if (postBtn) {
      postBtn.disabled = false;
      postBtn.textContent = 'Post to Bugzilla';
    }
  }
}

/**
 * Handle AI suggest button click.
 */
export async function handleAiSuggest() {
  const bugId = ui.getComposerBugId();
  if (!bugId) {
    ui.showError('No bug selected');
    return;
  }

  // Get the bug
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError('Bug not found');
    return;
  }

  // Get available responses
  const responses = cannedResponses.getAll();
  if (!responses || responses.length === 0) {
    ui.showInfo('No canned responses available');
    return;
  }

  // Get AI config
  const cfg = config.getConfig();
  const aiConfig = {
    provider: cfg.aiProvider,
    transport: cfg.aiTransport || 'browser',
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
  };

  if (!ai.isProviderConfigured(aiConfig)) {
    ui.showInfo('AI provider not configured. Please set up in Settings.');
    return;
  }

  // Disable button and show loading
  const suggestBtn = getElement(DOM_IDS.AI_SUGGEST_BTN);
  if (suggestBtn) {
    suggestBtn.disabled = true;
    suggestBtn.textContent = 'Suggesting...';
  }

  try {
    const result = await ai.suggestCannedResponse(bug, responses, aiConfig);

    if (result.selected_responses && result.selected_responses.length > 0) {
      // Auto-select the first suggested response
      const firstSuggestion = result.selected_responses[0];
      const select = getElement(DOM_IDS.CANNED_RESPONSE_SELECT);

      if (select) {
        select.value = firstSuggestion.id;
        // Trigger change event to load the template
        select.dispatchEvent(new Event('change'));
      }

      if (result.selected_responses.length > 1) {
        ui.showSuccess(`Suggested: ${firstSuggestion.id} (${result.selected_responses.length} options)`);
      } else {
        ui.showSuccess(`Suggested: ${firstSuggestion.id}`);
      }
    } else if (result.fallback_custom_text) {
      // Use fallback custom text
      ui.setComposerResponseBody(result.fallback_custom_text);
      ui.showInfo('No matching response found. AI provided a custom suggestion.');
    } else {
      ui.showInfo('AI could not suggest a response for this bug');
    }
  } catch (err) {
    ui.showError(`AI suggestion failed: ${err.message}`);
    console.error('[app] AI suggest error:', err);
  } finally {
    if (suggestBtn) {
      suggestBtn.disabled = false;
      suggestBtn.textContent = 'AI Suggest';
    }
  }
}

/**
 * Handle AI customize button click.
 */
export async function handleAiCustomize() {
  const bugId = ui.getComposerBugId();
  if (!bugId) {
    ui.showError('No bug selected');
    return;
  }

  // Get current selected response
  const select = getElement(DOM_IDS.CANNED_RESPONSE_SELECT);
  const responseId = select?.value;

  if (!responseId) {
    ui.showInfo('Please select a canned response first');
    return;
  }

  const cannedResponse = cannedResponses.getById(responseId);
  if (!cannedResponse) {
    ui.showError('Selected response not found');
    return;
  }

  // Get the bug
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError('Bug not found');
    return;
  }

  // Get AI config
  const cfg = config.getConfig();
  const aiConfig = {
    provider: cfg.aiProvider,
    transport: cfg.aiTransport || 'browser',
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
  };

  if (!ai.isProviderConfigured(aiConfig)) {
    ui.showInfo('AI provider not configured. Please set up in Settings.');
    return;
  }

  // Disable button and show loading
  const aiBtn = getElement(DOM_IDS.AI_CUSTOMIZE_BTN);
  if (aiBtn) {
    aiBtn.disabled = true;
    aiBtn.textContent = 'Customizing...';
  }

  try {
    const result = await ai.customizeCannedResponse(bug, cannedResponse, aiConfig);

    if (result.final_response) {
      ui.setComposerResponseBody(result.final_response);
      ui.showSuccess('Response customized with AI');
    } else {
      ui.showInfo('No customized response returned');
    }
  } catch (err) {
    ui.showError(`AI customization failed: ${err.message}`);
    console.error('[app] AI customize error:', err);
  } finally {
    if (aiBtn) {
      aiBtn.disabled = false;
      aiBtn.textContent = 'AI Customize';
    }
  }
}

/**
 * Handle AI generate button click.
 * Generates a response from scratch using AI.
 */
export async function handleAiGenerate() {
  const bugId = ui.getComposerBugId();
  if (!bugId) {
    ui.showError('No bug selected');
    return;
  }

  // Get the bug
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError('Bug not found');
    return;
  }

  // Get AI config
  const cfg = config.getConfig();
  const aiConfig = {
    provider: cfg.aiProvider,
    transport: cfg.aiTransport || 'browser',
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
  };

  if (!ai.isProviderConfigured(aiConfig)) {
    ui.showInfo('AI provider not configured. Please set up in Settings.');
    return;
  }

  // Disable button and show loading
  const generateBtn = getElement(DOM_IDS.AI_GENERATE_BTN);
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }

  try {
    // Get available canned responses for reference
    const responses = cannedResponses.getAll();

    const result = await ai.generateResponse(
      bug,
      { mode: 'response', cannedResponses: responses },
      aiConfig
    );

    if (result.response_text) {
      ui.setComposerResponseBody(result.response_text);
      ui.updateReasoningPanel(result);
      ui.showSuccess('Response generated');
    } else {
      ui.showInfo('No response generated');
    }
  } catch (err) {
    ui.showError(`AI generation failed: ${err.message}`);
    console.error('[app] AI generate error:', err);
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'AI Generate';
    }
  }
}

/**
 * Handle refine button click.
 * Refines the current response based on user instruction.
 */
export async function handleRefine() {
  const bugId = ui.getComposerBugId();
  if (!bugId) {
    ui.showError('No bug selected');
    return;
  }

  const currentResponse = ui.getComposerResponseBody();
  if (!currentResponse.trim()) {
    ui.showInfo('No response to refine. Generate or enter a response first.');
    return;
  }

  const instruction = ui.getRefineInstruction();
  if (!instruction.trim()) {
    ui.showInfo('Please enter a refinement instruction');
    return;
  }

  // Get the bug
  const bug = loadedBugs.find((b) => String(b.id) === String(bugId));
  if (!bug) {
    ui.showError('Bug not found');
    return;
  }

  // Get AI config
  const cfg = config.getConfig();
  const aiConfig = {
    provider: cfg.aiProvider,
    transport: cfg.aiTransport || 'browser',
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
  };

  if (!ai.isProviderConfigured(aiConfig)) {
    ui.showInfo('AI provider not configured. Please set up in Settings.');
    return;
  }

  // Disable button and show loading
  const refineBtn = getElement(DOM_IDS.REFINE_BTN);
  if (refineBtn) {
    refineBtn.disabled = true;
    refineBtn.textContent = 'Refining...';
  }

  try {
    // Check if a canned response is selected for context
    const select = getElement(DOM_IDS.CANNED_RESPONSE_SELECT);
    const responseId = select?.value;
    const context = {};
    if (responseId) {
      context.selectedCannedResponse = cannedResponses.getById(responseId);
    }

    const result = await ai.refineResponse(
      bug,
      currentResponse,
      instruction,
      context,
      aiConfig
    );

    if (result.refined_response) {
      ui.setComposerResponseBody(result.refined_response);
      ui.clearRefineInstruction();

      if (result.changes_made && result.changes_made.length > 0) {
        ui.showSuccess(`Refined: ${result.changes_made.join(', ')}`);
      } else {
        ui.showSuccess('Response refined');
      }
    }
  } catch (err) {
    ui.showError(`AI refinement failed: ${err.message}`);
    console.error('[app] AI refine error:', err);
  } finally {
    if (refineBtn) {
      refineBtn.disabled = false;
      refineBtn.textContent = 'Refine';
    }
  }
}

/**
 * Handle click on a refine chip.
 * @param {Event} event - Click event
 */
export async function handleRefineChipClick(event) {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  const instruction = chip.dataset.instruction;
  if (!instruction) return;

  // Set the instruction in the input field
  const input = getElement(DOM_IDS.REFINE_INSTRUCTION);
  if (input) {
    input.value = instruction;
  }

  // Trigger the refine action
  await handleRefine();
}

/**
 * Refresh the canned responses UI.
 * @param {string} [categoryFilter] - Optional category to filter by
 */
export function refreshCannedResponsesUI(categoryFilter = '') {
  let responses = cannedResponses.getAll();

  // Filter by category if specified
  if (categoryFilter) {
    responses = cannedResponses.getByCategory(categoryFilter);
  }

  // Update the list
  ui.renderCannedResponsesList(responses);

  // Update category filter dropdown
  const allResponses = cannedResponses.getAll();
  const categories = ui.extractCategories(allResponses);
  ui.updateCannedCategoryFilter(categories, categoryFilter);
}

/**
 * Handle canned responses markdown import.
 * @param {Event} event - Change event from file input
 */
export async function handleImportCannedMd(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const replaceCheckbox = getElement(DOM_IDS.IMPORT_REPLACE);
  const replace = replaceCheckbox?.checked || false;

  try {
    const text = await file.text();
    cannedResponses.importMarkdown(text, { replace });

    ui.showSuccess(`Imported canned responses from ${file.name}`);
    refreshCannedResponsesUI();
  } catch (err) {
    ui.showError(`Failed to import: ${err.message}`);
  }

  // Reset file input
  event.target.value = '';
}

/**
 * Handle canned responses category filter change.
 * @param {Event} event - Change event from select
 */
export function handleCannedCategoryFilter(event) {
  const category = event.target.value;
  refreshCannedResponsesUI(category);
}

/**
 * Handle actions on canned response cards (copy, delete).
 * @param {Event} event - Click event
 */
export async function handleCannedResponseAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const responseId = button.dataset.responseId;

  if (!responseId) return;

  if (action === 'copy') {
    const response = cannedResponses.getById(responseId);
    if (response) {
      try {
        await navigator.clipboard.writeText(response.bodyTemplate);
        ui.showSuccess('Copied to clipboard');
      } catch (err) {
        ui.showError('Failed to copy to clipboard');
      }
    }
  } else if (action === 'delete') {
    const deleted = cannedResponses.deleteResponse(responseId);
    if (deleted) {
      ui.showSuccess('Deleted response');
      refreshCannedResponsesUI();
    }
  }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

console.log('[app] Module loaded');
