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
export function init() {
  console.log('[app] Initializing application...');
  setupEventListeners();
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

  // TODO: Compute heuristic tags (L2-F1)
  // TODO: Run AI classification if configured (L3)

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
    await processAllBugs(loadedBugs);
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
  // TODO: Implement JSON export (L4-F8)
  console.log('[app] Export JSON clicked');
}

/**
 * Handle export CSV button click.
 */
function handleExportCsv() {
  // TODO: Implement CSV export (L4-F8)
  console.log('[app] Export CSV clicked');
}

/**
 * Handle export Markdown button click.
 */
function handleExportMarkdown() {
  // TODO: Implement Markdown export (L4-F8)
  console.log('[app] Export Markdown clicked');
}

/**
 * Handle import JSON file change.
 * @param {Event} event - File input change event
 */
function handleImportJson(event) {
  // TODO: Implement JSON import (L4-F9)
  console.log('[app] Import JSON:', event.target?.files);
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
    const processed = await processBug(bug, { fetchDetails: true });

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

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

console.log('[app] Module loaded');
