/**
 * @fileoverview UI rendering module.
 *
 * Responsibilities:
 * - Render bug list table
 * - Display tags as colored badges with tooltips
 * - Show expandable summary rows
 * - Handle loading states and error display
 * - Manage filter controls UI
 *
 * @module ui
 */

/** DOM element IDs used by this module */
export const DOM_IDS = {
  BUG_TABLE: 'bug-table',
  BUG_TABLE_BODY: 'bug-table-body',
  BUG_TABLE_CONTAINER: 'bug-table-container',
  EMPTY_STATE: 'empty-state',
  LOADING_OVERLAY: 'loading-overlay',
  LOADING_MESSAGE: 'loading-message',
  TOAST_CONTAINER: 'toast-container',
  BUG_COUNT: 'bug-count',
  INCLUDE_TAGS: 'include-tags',
  EXCLUDE_TAGS: 'exclude-tags',
};

/** Default Bugzilla host for bug links */
const DEFAULT_BUGZILLA_HOST = 'https://bugzilla.mozilla.org';

/** Maximum length for summary display before truncation */
const MAX_SUMMARY_LENGTH = 120;

/** Default toast duration in milliseconds */
const DEFAULT_TOAST_DURATION = 4000;

/**
 * Get a DOM element by ID with null check.
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function getElement(id) {
  return document.getElementById(id);
}

/**
 * Render the bug list table.
 * @param {Object[]} bugs - Array of bug objects to display
 * @param {Object} [options] - Render options
 * @param {string} [options.bugzillaHost] - Bugzilla host for links
 */
export function renderBugTable(bugs, options = {}) {
  const tbody = getElement(DOM_IDS.BUG_TABLE_BODY);
  const emptyState = getElement(DOM_IDS.EMPTY_STATE);

  if (!tbody) {
    console.warn('[ui] Bug table body not found');
    return;
  }

  // Clear existing rows
  tbody.innerHTML = '';

  // Show/hide empty state
  if (emptyState) {
    emptyState.hidden = bugs && bugs.length > 0;
  }

  // Update bug count
  updateBugCount(bugs?.length || 0);

  // Render each bug row
  if (bugs && bugs.length > 0) {
    const bugzillaHost = options.bugzillaHost || DEFAULT_BUGZILLA_HOST;
    bugs.forEach((bug) => {
      const row = renderBugRow(bug, { bugzillaHost });
      tbody.appendChild(row);
    });
  }
}

/**
 * Render a single bug row.
 * @param {Object} bug - Bug object
 * @param {Object} [options] - Render options
 * @returns {HTMLTableRowElement}
 */
export function renderBugRow(bug, options = {}) {
  const row = document.createElement('tr');
  row.dataset.bugId = String(bug.id);

  const bugzillaHost = options.bugzillaHost || DEFAULT_BUGZILLA_HOST;
  const bugUrl = `${bugzillaHost}/show_bug.cgi?id=${bug.id}`;

  // Truncate long summaries
  let summary = bug.summary || '';
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
  }

  // Create cells
  row.innerHTML = `
    <td><a href="${bugUrl}" target="_blank" rel="noopener">${bug.id}</a></td>
    <td>${escapeHtml(bug.status || '')}</td>
    <td>${escapeHtml(bug.product || '')}</td>
    <td>${escapeHtml(bug.component || '')}</td>
    <td class="summary-cell" title="${escapeHtml(bug.summary || '')}">${escapeHtml(summary)}</td>
    <td class="tags-cell"></td>
    <td class="actions-cell"></td>
  `;

  // Add tags
  const tagsCell = row.querySelector('.tags-cell');
  tagsCell.appendChild(renderTags(bug.tags));

  // Add action buttons
  const actionsCell = row.querySelector('.actions-cell');
  actionsCell.appendChild(renderActions(bug));

  return row;
}

/**
 * Render action buttons for a bug row.
 * @param {Object} bug - Bug object
 * @returns {HTMLElement}
 */
function renderActions(bug) {
  const container = document.createElement('div');
  container.className = 'actions-container';

  // Process button
  const processBtn = document.createElement('button');
  processBtn.type = 'button';
  processBtn.className = 'btn-small';
  processBtn.textContent = 'Process';
  processBtn.dataset.action = 'process';
  processBtn.dataset.bugId = String(bug.id);
  container.appendChild(processBtn);

  // Summary toggle button
  const summaryBtn = document.createElement('button');
  summaryBtn.type = 'button';
  summaryBtn.className = 'btn-small';
  summaryBtn.textContent = 'Summary';
  summaryBtn.dataset.action = 'toggle-summary';
  summaryBtn.dataset.bugId = String(bug.id);
  summaryBtn.setAttribute('aria-expanded', 'false');
  container.appendChild(summaryBtn);

  return container;
}

/**
 * Render tags as colored badges.
 * @param {Object[]} tags - Array of tag objects
 * @returns {HTMLElement} Container with badge elements
 */
export function renderTags(tags) {
  const container = document.createElement('div');
  container.className = 'tags-container';

  if (!tags || !Array.isArray(tags)) {
    return container;
  }

  tags.forEach((tag) => {
    const badge = document.createElement('span');
    badge.className = `tag-badge tag-${tag.id}`;
    badge.textContent = tag.label || tag.id;

    if (tag.evidence) {
      badge.title = tag.evidence;
    }

    container.appendChild(badge);
  });

  return container;
}

/**
 * Render tags with optional "Set Has STR" suggestion button.
 * @param {Object[]} tags - Array of tag objects
 * @param {boolean} hasStrSuggested - Whether to show the "Set Has STR" button
 * @param {string|number} [bugId] - Bug ID for the button data attribute
 * @returns {HTMLElement} Container with badge elements and optional button
 */
export function renderTagsWithSuggestion(tags, hasStrSuggested, bugId) {
  const container = document.createElement('div');
  container.className = 'tags-container';

  // Render tags
  if (tags && Array.isArray(tags)) {
    tags.forEach((tag) => {
      const badge = document.createElement('span');
      badge.className = `tag-badge tag-${tag.id}`;
      badge.textContent = tag.label || tag.id;

      if (tag.evidence) {
        badge.title = tag.evidence;
      }

      container.appendChild(badge);
    });
  }

  // Add "Set Has STR" button if suggested
  if (hasStrSuggested) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-small btn-set-has-str';
    btn.textContent = 'Set Has STR';
    btn.dataset.action = 'set-has-str';
    if (bugId !== undefined) {
      btn.dataset.bugId = String(bugId);
    }
    btn.title = 'Mark this bug as having Steps To Reproduce';
    container.appendChild(btn);
  }

  return container;
}

/**
 * Show/hide loading spinner.
 * @param {boolean} show - Whether to show the spinner
 * @param {string} [message='Loading...'] - Loading message
 */
export function setLoading(show, message = 'Loading...') {
  const overlay = getElement(DOM_IDS.LOADING_OVERLAY);
  const messageEl = getElement(DOM_IDS.LOADING_MESSAGE);

  if (overlay) {
    overlay.hidden = !show;
  }

  if (messageEl) {
    messageEl.textContent = message;
  }
}

/**
 * Show a toast notification.
 * @param {string} message - Toast message
 * @param {'success'|'error'|'info'} type - Toast type
 * @param {number} [duration] - Duration in ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = DEFAULT_TOAST_DURATION) {
  const container = getElement(DOM_IDS.TOAST_CONTAINER);
  if (!container) {
    console.warn('[ui] Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  container.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
  }

  return toast;
}

/**
 * Show an error message to the user.
 * @param {string} message - Error message
 * @param {Object} [options] - Display options
 */
export function showError(message, options = {}) {
  return showToast(message, 'error', options.duration || DEFAULT_TOAST_DURATION);
}

/**
 * Show a success message to the user.
 * @param {string} message - Success message
 * @param {Object} [options] - Display options
 */
export function showSuccess(message, options = {}) {
  return showToast(message, 'success', options.duration || DEFAULT_TOAST_DURATION);
}

/**
 * Show an info message to the user.
 * @param {string} message - Info message
 * @param {Object} [options] - Display options
 */
export function showInfo(message, options = {}) {
  return showToast(message, 'info', options.duration || DEFAULT_TOAST_DURATION);
}

/**
 * Toggle the expandable summary row for a bug.
 * @param {string|number} bugId - Bug ID
 * @param {string} summary - Summary text to display
 */
export function toggleSummary(bugId, summary) {
  const bugRow = document.querySelector(`tr[data-bug-id="${bugId}"]`);
  if (!bugRow) {
    console.warn(`[ui] Bug row not found for ID: ${bugId}`);
    return;
  }

  // Check if summary row already exists
  const existingSummary = bugRow.nextElementSibling;
  if (existingSummary && existingSummary.classList.contains('summary-row')) {
    // Remove existing summary row
    existingSummary.remove();
    // Update aria-expanded
    const btn = bugRow.querySelector('[data-action="toggle-summary"]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    return;
  }

  // Create summary row
  const summaryRow = document.createElement('tr');
  summaryRow.className = 'summary-row';
  summaryRow.dataset.summaryFor = String(bugId);

  const summaryCell = document.createElement('td');
  summaryCell.colSpan = 7;
  summaryCell.className = 'summary-content';
  summaryCell.innerHTML = `
    <div class="summary-text">
      <strong>AI Summary:</strong>
      <p>${escapeHtml(summary || 'No summary available')}</p>
    </div>
  `;

  summaryRow.appendChild(summaryCell);
  bugRow.after(summaryRow);

  // Update aria-expanded
  const btn = bugRow.querySelector('[data-action="toggle-summary"]');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

/**
 * Update the filter UI controls.
 * @param {string[]} availableTags - All available tag IDs
 * @param {Object} currentFilter - Current filter state
 * @param {string[]} [currentFilter.include] - Tags to include
 * @param {string[]} [currentFilter.exclude] - Tags to exclude
 */
export function updateFilterControls(availableTags, currentFilter = {}) {
  const includeContainer = getElement(DOM_IDS.INCLUDE_TAGS);
  const excludeContainer = getElement(DOM_IDS.EXCLUDE_TAGS);

  const include = currentFilter.include || [];
  const exclude = currentFilter.exclude || [];

  // Helper to create checkbox label
  const createCheckbox = (tagId, isChecked, prefix) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = `${prefix}-${tagId}`;
    checkbox.value = tagId;
    checkbox.checked = isChecked;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${formatTagLabel(tagId)}`));

    return label;
  };

  // Populate include tags
  if (includeContainer) {
    includeContainer.innerHTML = '';
    availableTags.forEach((tagId) => {
      const checkbox = createCheckbox(tagId, include.includes(tagId), 'include');
      includeContainer.appendChild(checkbox);
    });
  }

  // Populate exclude tags
  if (excludeContainer) {
    excludeContainer.innerHTML = '';
    availableTags.forEach((tagId) => {
      const checkbox = createCheckbox(tagId, exclude.includes(tagId), 'exclude');
      excludeContainer.appendChild(checkbox);
    });
  }
}

/**
 * Update the bug count display.
 * @param {number} count - Number of bugs
 */
export function updateBugCount(count) {
  const countEl = getElement(DOM_IDS.BUG_COUNT);
  if (!countEl) return;

  if (count === 0) {
    countEl.textContent = '';
  } else if (count === 1) {
    countEl.textContent = '(1 bug)';
  } else {
    countEl.textContent = `(${count} bugs)`;
  }
}

/**
 * Clear the bug table.
 */
export function clearBugTable() {
  const tbody = getElement(DOM_IDS.BUG_TABLE_BODY);
  const emptyState = getElement(DOM_IDS.EMPTY_STATE);

  if (tbody) {
    tbody.innerHTML = '';
  }

  if (emptyState) {
    emptyState.hidden = false;
  }

  updateBugCount(0);
}

/**
 * Sort bugs array by a field.
 * @param {Object[]} bugs - Array of bugs (will not be modified)
 * @param {string} field - Field to sort by
 * @param {'asc'|'desc'} direction - Sort direction
 * @returns {Object[]} Sorted copy of bugs array
 */
export function sortBugs(bugs, field, direction = 'asc') {
  const sorted = [...bugs];
  const multiplier = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // Handle numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }

    // String comparison
    const aStr = String(aVal || '').toLowerCase();
    const bStr = String(bVal || '').toLowerCase();
    return aStr.localeCompare(bStr) * multiplier;
  });

  return sorted;
}

/**
 * Format a tag ID as a human-readable label.
 * @param {string} tagId - Tag ID (e.g., 'has-str')
 * @returns {string} Formatted label
 */
function formatTagLabel(tagId) {
  return tagId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Open the response composer for a bug.
 * @param {Object} bug - Bug object
 * @param {Object[]} cannedResponses - Available canned responses
 */
export function openResponseComposer(bug, cannedResponses) {
  // TODO: Implement in L4 (canned responses)
  console.log('[ui] Opening response composer for:', bug?.id);
}

console.log('[ui] Module loaded');
