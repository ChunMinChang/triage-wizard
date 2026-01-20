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
  CANNED_RESPONSES_LIST: 'canned-responses-list',
  CANNED_CATEGORY_FILTER: 'canned-category-filter',
  IMPORT_CANNED_MD: 'import-canned-md',
  IMPORT_REPLACE: 'import-replace',
  RESPONSE_COMPOSER_MODAL: 'response-composer-modal',
  COMPOSER_BUG_ID: 'composer-bug-id',
  CLOSE_COMPOSER_BTN: 'close-composer-btn',
  CANNED_RESPONSE_SELECT: 'canned-response-select',
  RESPONSE_BODY: 'response-body',
  COPY_RESPONSE_BTN: 'copy-response-btn',
  POST_RESPONSE_BTN: 'post-response-btn',
  // Canned response editor
  CANNED_EDITOR_MODAL: 'canned-editor-modal',
  CANNED_EDITOR_TITLE: 'canned-editor-title',
  CANNED_EDITOR_FORM: 'canned-editor-form',
  CANNED_EDITOR_ID: 'canned-editor-id',
  CANNED_EDITOR_TITLE_INPUT: 'canned-editor-title-input',
  CANNED_EDITOR_CATEGORIES: 'canned-editor-categories',
  CANNED_EDITOR_DESCRIPTION: 'canned-editor-description',
  CANNED_EDITOR_BODY: 'canned-editor-body',
  CLOSE_CANNED_EDITOR_BTN: 'close-canned-editor-btn',
  CANCEL_CANNED_EDITOR_BTN: 'cancel-canned-editor-btn',
  SAVE_CANNED_EDITOR_BTN: 'save-canned-editor-btn',
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

  // Add tags with "Set Has STR" button if suggested
  const tagsCell = row.querySelector('.tags-cell');
  tagsCell.appendChild(renderTagsWithSuggestion(bug.tags, bug.hasStrSuggested, bug.id));

  // Add suggested response badge if applicable
  if (bug.suggestedResponseId) {
    const suggestionBadge = document.createElement('span');
    suggestionBadge.className = 'tag-badge tag-suggestion';
    suggestionBadge.textContent = `Suggest: ${bug.suggestedResponseId}`;
    suggestionBadge.title = 'Click Compose to use this suggested response';
    tagsCell.appendChild(suggestionBadge);
  }

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

  // Compose response button
  const composeBtn = document.createElement('button');
  composeBtn.type = 'button';
  composeBtn.className = 'btn-small';
  composeBtn.textContent = 'Compose';
  composeBtn.dataset.action = 'compose';
  composeBtn.dataset.bugId = String(bug.id);
  container.appendChild(composeBtn);

  // Show test page link if one was generated during AI processing
  if (bug.generatedTestPageUrl) {
    // Link to open test page in new tab
    const testLink = document.createElement('a');
    testLink.href = bug.generatedTestPageUrl;
    testLink.target = '_blank';
    testLink.rel = 'noopener noreferrer';
    testLink.className = 'btn-small btn-test-page';
    testLink.textContent = 'Open Test';
    testLink.title = bug.generatedTestPageReason || 'Open generated test page';
    container.appendChild(testLink);

    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-small btn-download-test';
    downloadBtn.textContent = '⬇';
    downloadBtn.title = 'Download test page';
    downloadBtn.dataset.action = 'download-test';
    downloadBtn.dataset.bugId = String(bug.id);
    container.appendChild(downloadBtn);
  }

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
 * @param {Object} [triageInfo] - Optional triage information
 */
export function toggleSummary(bugId, summary, triageInfo = null) {
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

  showSummaryRow(bugId, summary, triageInfo);
}

/**
 * Show the summary row for a bug (always shows, doesn't toggle).
 * @param {string|number} bugId - Bug ID
 * @param {string} summary - Summary text to display
 * @param {Object} [triageInfo] - Optional triage information
 * @param {string} [triageInfo.severity] - Suggested severity
 * @param {string} [triageInfo.priority] - Suggested priority
 * @param {Array} [triageInfo.actions] - Suggested actions
 * @param {string} [triageInfo.reasoning] - Triage reasoning
 */
export function showSummaryRow(bugId, summary, triageInfo = null) {
  const bugRow = document.querySelector(`tr[data-bug-id="${bugId}"]`);
  if (!bugRow) {
    console.warn(`[ui] Bug row not found for ID: ${bugId}`);
    return;
  }

  // Remove existing summary row if present
  const existingSummary = bugRow.nextElementSibling;
  if (existingSummary && existingSummary.classList.contains('summary-row')) {
    existingSummary.remove();
  }

  // Create summary row
  const summaryRow = document.createElement('tr');
  summaryRow.className = 'summary-row';
  summaryRow.dataset.summaryFor = String(bugId);

  // Build content HTML
  let contentHtml = `
    <div class="summary-text">
      <strong>AI Summary:</strong>
      <p>${escapeHtml(summary || 'No summary available')}</p>
    </div>
  `;

  // Add triage info if available
  if (triageInfo) {
    const { severity, priority, actions, reasoning } = triageInfo;

    contentHtml += '<div class="triage-suggestions">';

    // Severity and Priority
    if (severity || priority) {
      contentHtml += '<div class="triage-fields">';
      if (severity && severity !== '--') {
        contentHtml += `<span class="triage-field"><strong>Severity:</strong> ${escapeHtml(severity)}</span>`;
      }
      if (priority && priority !== '--') {
        contentHtml += `<span class="triage-field"><strong>Priority:</strong> ${escapeHtml(priority)}</span>`;
      }
      contentHtml += '</div>';
    }

    // Suggested actions
    if (actions && actions.length > 0) {
      contentHtml += '<div class="triage-actions"><strong>Suggested Actions:</strong><ul>';
      for (const action of actions) {
        contentHtml += `<li><strong>${escapeHtml(action.action)}</strong>: ${escapeHtml(action.reason || '')}</li>`;
      }
      contentHtml += '</ul></div>';
    }

    // Reasoning
    if (reasoning) {
      contentHtml += `<div class="triage-reasoning"><strong>Reasoning:</strong> ${escapeHtml(reasoning)}</div>`;
    }

    contentHtml += '</div>';

    // Add compose hint
    contentHtml += `
      <div class="compose-hint">
        <button type="button" class="btn-primary compose-hint-btn" data-action="compose" data-bug-id="${bugId}">
          Compose Response
        </button>
        <span class="hint-text">Click to draft a response based on AI suggestions</span>
      </div>
    `;
  }

  const summaryCell = document.createElement('td');
  summaryCell.colSpan = 7;
  summaryCell.className = 'summary-content';
  summaryCell.innerHTML = contentHtml;

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
  const modal = getElement(DOM_IDS.RESPONSE_COMPOSER_MODAL);
  if (!modal) {
    console.warn('[ui] Response composer modal not found');
    return;
  }

  // Set bug ID
  const bugIdSpan = getElement(DOM_IDS.COMPOSER_BUG_ID);
  if (bugIdSpan) {
    bugIdSpan.textContent = `Bug ${bug?.id || 'unknown'}`;
    bugIdSpan.dataset.bugId = String(bug?.id || '');
  }

  // Populate canned response dropdown
  const select = getElement(DOM_IDS.CANNED_RESPONSE_SELECT);
  if (select) {
    // Keep first option, clear rest
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    // Add canned response options
    if (cannedResponses && cannedResponses.length > 0) {
      cannedResponses.forEach((response) => {
        const option = document.createElement('option');
        option.value = response.id;
        option.textContent = response.title || response.id;
        select.appendChild(option);
      });
    }
  }

  // Clear response body
  const textarea = getElement(DOM_IDS.RESPONSE_BODY);
  if (textarea) {
    textarea.value = '';
  }

  // Check for AI-suggested canned response (priority over heuristic suggestion)
  const aiSuggestedId = bug?.aiSuggestedCannedId;
  const aiDraftResponse = bug?.aiDraftResponse;
  const heuristicSuggestedId = bug?.suggestedResponseId;

  // Use AI suggestion if available, otherwise fall back to heuristic
  const suggestedId = aiSuggestedId || heuristicSuggestedId;

  if (suggestedId && select) {
    const options = Array.from(select.options);
    const matchingOption = options.find((opt) => opt.value === suggestedId);
    if (matchingOption) {
      select.value = suggestedId;

      // Use AI draft response if available, otherwise use template
      if (aiDraftResponse && textarea) {
        textarea.value = aiDraftResponse;
        showInfo(`AI suggested: ${suggestedId}`);
      } else {
        // Find and load the response template
        const suggestedResponse = cannedResponses?.find((r) => r.id === suggestedId);
        if (suggestedResponse && textarea) {
          textarea.value = suggestedResponse.bodyTemplate || '';
        }
        // Show a toast notification
        showInfo(`Auto-selected: ${suggestedId}`);
      }
    }
  } else if (aiDraftResponse && textarea) {
    // AI provided a draft without matching canned response
    textarea.value = aiDraftResponse;
    showInfo('AI generated a custom response');
  }

  // Show AI triage suggestions in reasoning panel if available
  if (bug?.aiTriageReasoning || bug?.aiSuggestedActions?.length > 0) {
    const triageResult = {
      reasoning: buildTriageReasoningText(bug),
      suggested_actions: bug.aiSuggestedActions || [],
    };
    updateReasoningPanel(triageResult);
  } else {
    clearReasoningPanel();
  }

  // Hide suggested actions panel when opening composer
  hideSuggestedActions();

  // Show modal
  modal.hidden = false;
}

/**
 * Build triage reasoning text from bug's AI suggestions.
 * @param {Object} bug - Bug object with AI suggestions
 * @returns {string} Formatted reasoning text
 */
function buildTriageReasoningText(bug) {
  const parts = [];

  // Add severity and priority
  if (bug.aiSuggestedSeverity && bug.aiSuggestedSeverity !== '--') {
    parts.push(`Suggested Severity: ${bug.aiSuggestedSeverity}`);
  }
  if (bug.aiSuggestedPriority && bug.aiSuggestedPriority !== '--') {
    parts.push(`Suggested Priority: ${bug.aiSuggestedPriority}`);
  }

  // Add reasoning
  if (bug.aiTriageReasoning) {
    if (parts.length > 0) {
      parts.push('');
    }
    parts.push(bug.aiTriageReasoning);
  }

  return parts.join('\n');
}

/**
 * Close the response composer.
 */
export function closeResponseComposer() {
  const modal = getElement(DOM_IDS.RESPONSE_COMPOSER_MODAL);
  if (modal) {
    modal.hidden = true;
  }
}

/**
 * Get the current bug ID from the composer.
 * @returns {string|null} Bug ID or null
 */
export function getComposerBugId() {
  const bugIdSpan = getElement(DOM_IDS.COMPOSER_BUG_ID);
  return bugIdSpan?.dataset.bugId || null;
}

/**
 * Get the current response body text.
 * @returns {string} Response body text
 */
export function getComposerResponseBody() {
  const textarea = getElement(DOM_IDS.RESPONSE_BODY);
  return textarea?.value || '';
}

/**
 * Set the response body text.
 * @param {string} text - Text to set
 */
export function setComposerResponseBody(text) {
  const textarea = getElement(DOM_IDS.RESPONSE_BODY);
  if (textarea) {
    textarea.value = text;
  }
}

/**
 * Get the refine instruction input value.
 * @returns {string} Instruction text
 */
export function getRefineInstruction() {
  const input = document.getElementById('refine-instruction');
  return input ? input.value.trim() : '';
}

/**
 * Clear the refine instruction input.
 */
export function clearRefineInstruction() {
  const input = document.getElementById('refine-instruction');
  if (input) {
    input.value = '';
  }
}

/**
 * Get instructions from selected refine chips.
 * @returns {string[]} Array of selected chip instructions
 */
export function getSelectedRefineChips() {
  const chips = document.querySelectorAll('.refine-chips .chip.selected');
  return Array.from(chips).map(chip => chip.dataset.instruction).filter(Boolean);
}

/**
 * Clear the selected state from all refine chips.
 */
export function clearSelectedRefineChips() {
  const chips = document.querySelectorAll('.refine-chips .chip.selected');
  chips.forEach(chip => chip.classList.remove('selected'));
}

/**
 * Update the AI reasoning panel with generate response results.
 * @param {Object} result - Result from generateResponse
 * @param {string} result.reasoning - AI's reasoning text
 * @param {Array} result.suggested_actions - Suggested actions
 * @param {Array} result.used_canned_ids - IDs of canned responses used
 */
export function updateReasoningPanel(result) {
  const content = document.getElementById('ai-reasoning-content');
  if (!content) return;

  const parts = [];

  if (result.reasoning) {
    parts.push(`<div class="reasoning-text">${escapeHtml(result.reasoning)}</div>`);
  }

  if (result.suggested_actions && result.suggested_actions.length > 0) {
    parts.push('<div class="suggested-actions">');
    parts.push('<h4>Suggested Actions:</h4>');
    result.suggested_actions.forEach((action) => {
      parts.push(`<div class="action-item" data-action="${escapeHtml(action.action)}">`);
      parts.push(`<span class="action-badge">${escapeHtml(action.action)}</span>`);
      if (action.reason) {
        parts.push(`<span class="action-reason">${escapeHtml(action.reason)}</span>`);
      }
      parts.push('</div>');
    });
    parts.push('</div>');
  }

  if (result.used_canned_ids && result.used_canned_ids.length > 0) {
    parts.push('<div class="used-canned">');
    parts.push('<strong>Referenced:</strong> ' + result.used_canned_ids.map(escapeHtml).join(', '));
    parts.push('</div>');
  }

  if (parts.length === 0) {
    parts.push('<p class="empty-state">No reasoning available.</p>');
  }

  content.innerHTML = parts.join('');

  // Open the panel to show the results
  const panel = document.getElementById('ai-reasoning-panel');
  if (panel) {
    panel.open = true;
  }
}

/**
 * Clear the AI reasoning panel.
 */
export function clearReasoningPanel() {
  const content = document.getElementById('ai-reasoning-content');
  if (content) {
    content.innerHTML = '<p class="empty-state">No AI reasoning available yet. Click "AI Generate" to get started.</p>';
  }

  const panel = document.getElementById('ai-reasoning-panel');
  if (panel) {
    panel.open = false;
  }
}

/**
 * Show suggested actions in the prominent actions panel.
 * @param {Array} actions - Array of action objects {action, reason, fields}
 */
export function showSuggestedActions(actions) {
  const panel = document.getElementById('suggested-actions-panel');
  const list = document.getElementById('suggested-actions-list');

  if (!panel || !list) return;

  // Clear existing actions
  list.innerHTML = '';

  if (!actions || actions.length === 0) {
    panel.hidden = true;
    return;
  }

  // Create action buttons
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn';
    btn.dataset.action = action.action;

    // Store additional data for some action types
    if (action.fields && Array.isArray(action.fields)) {
      btn.dataset.fields = action.fields.join(',');
    }

    // Map action types to display labels and styles
    const actionConfig = getActionConfig(action.action);
    btn.innerHTML = `<span class="action-icon">${actionConfig.icon}</span>${actionConfig.label}`;

    if (actionConfig.className) {
      btn.classList.add(actionConfig.className);
    }

    // Add tooltip with reason
    if (action.reason) {
      btn.title = action.reason;
    }

    list.appendChild(btn);
  });

  // Show the panel
  panel.hidden = false;
}

/**
 * Hide the suggested actions panel.
 */
export function hideSuggestedActions() {
  const panel = document.getElementById('suggested-actions-panel');
  if (panel) {
    panel.hidden = true;
  }
}

/**
 * Get display configuration for an action type.
 * @param {string} actionType - Action type identifier
 * @returns {Object} Configuration with icon, label, className
 */
function getActionConfig(actionType) {
  const configs = {
    'set-has-str': {
      icon: '✓',
      label: 'Set Has STR',
      className: '',
    },
    'need-info': {
      icon: '❓',
      label: 'Request Info',
      className: 'action-btn-warning',
    },
    'request-str': {
      icon: '📝',
      label: 'Request STR',
      className: '',
    },
    'request-profile': {
      icon: '📊',
      label: 'Request Profile',
      className: '',
    },
    'close-duplicate': {
      icon: '🔗',
      label: 'Mark Duplicate',
      className: 'action-btn-danger',
    },
    'close-wontfix': {
      icon: '✕',
      label: 'Close WONTFIX',
      className: 'action-btn-danger',
    },
    'assign': {
      icon: '👤',
      label: 'Assign',
      className: '',
    },
    'set-priority': {
      icon: '⚡',
      label: 'Set Priority',
      className: '',
    },
  };

  return configs[actionType] || {
    icon: '•',
    label: actionType,
    className: '',
  };
}

/**
 * Render a single canned response card.
 * @param {Object} response - Canned response object
 * @returns {HTMLElement} Card element
 */
export function renderCannedResponseCard(response) {
  const card = document.createElement('div');
  card.className = 'canned-response-card';
  card.dataset.responseId = response.id;

  // Header with title, ID, and actions
  const header = document.createElement('div');
  header.className = 'canned-response-header';

  const titleSection = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'canned-response-title';
  title.textContent = response.title || response.id;
  titleSection.appendChild(title);

  const idSpan = document.createElement('span');
  idSpan.className = 'canned-response-id';
  idSpan.textContent = response.id;
  titleSection.appendChild(idSpan);

  // Categories
  if (response.categories && response.categories.length > 0) {
    const categoriesDiv = document.createElement('div');
    categoriesDiv.className = 'canned-response-categories';
    response.categories.forEach((cat) => {
      const badge = document.createElement('span');
      badge.className = 'category-badge';
      badge.textContent = cat;
      categoriesDiv.appendChild(badge);
    });
    titleSection.appendChild(categoriesDiv);
  }

  header.appendChild(titleSection);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'canned-response-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-small';
  editBtn.textContent = 'Edit';
  editBtn.dataset.action = 'edit';
  editBtn.dataset.responseId = response.id;
  actions.appendChild(editBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-small';
  copyBtn.textContent = 'Copy';
  copyBtn.dataset.action = 'copy';
  copyBtn.dataset.responseId = response.id;
  actions.appendChild(copyBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-small btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.responseId = response.id;
  actions.appendChild(deleteBtn);

  header.appendChild(actions);
  card.appendChild(header);

  // Description
  if (response.description) {
    const desc = document.createElement('p');
    desc.className = 'canned-response-description';
    desc.textContent = response.description;
    card.appendChild(desc);
  }

  return card;
}

/**
 * Render the canned responses list.
 * @param {Object[]} responses - Array of canned response objects
 */
export function renderCannedResponsesList(responses) {
  const container = getElement(DOM_IDS.CANNED_RESPONSES_LIST);
  if (!container) {
    console.warn('[ui] Canned responses list container not found');
    return;
  }

  container.innerHTML = '';

  if (!responses || responses.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No canned responses loaded. Import a Markdown file or wait for defaults to load.';
    container.appendChild(emptyState);
    return;
  }

  responses.forEach((response) => {
    const card = renderCannedResponseCard(response);
    container.appendChild(card);
  });
}

/**
 * Update the category filter dropdown.
 * @param {string[]} categories - Unique category list
 * @param {string} selectedCategory - Currently selected category
 */
export function updateCannedCategoryFilter(categories, selectedCategory = '') {
  const select = getElement(DOM_IDS.CANNED_CATEGORY_FILTER);
  if (!select) return;

  // Keep the first "All categories" option
  const firstOption = select.options[0];
  select.innerHTML = '';
  select.appendChild(firstOption);

  // Add category options
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (cat === selectedCategory) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Get all unique categories from responses.
 * @param {Object[]} responses - Array of canned response objects
 * @returns {string[]} Unique sorted categories
 */
export function extractCategories(responses) {
  if (!responses || !Array.isArray(responses)) return [];

  const categories = new Set();
  responses.forEach((r) => {
    if (r.categories && Array.isArray(r.categories)) {
      r.categories.forEach((cat) => categories.add(cat));
    }
  });

  return Array.from(categories).sort();
}

// =====================================
// Canned Response Editor Functions
// =====================================

/**
 * Open the canned response editor modal.
 * @param {Object|null} response - Response to edit, or null for new response
 */
export function openCannedEditor(response = null) {
  const modal = getElement(DOM_IDS.CANNED_EDITOR_MODAL);
  const title = getElement(DOM_IDS.CANNED_EDITOR_TITLE);
  const form = getElement(DOM_IDS.CANNED_EDITOR_FORM);
  const idInput = getElement(DOM_IDS.CANNED_EDITOR_ID);
  const titleInput = getElement(DOM_IDS.CANNED_EDITOR_TITLE_INPUT);
  const categoriesInput = getElement(DOM_IDS.CANNED_EDITOR_CATEGORIES);
  const descriptionInput = getElement(DOM_IDS.CANNED_EDITOR_DESCRIPTION);
  const bodyInput = getElement(DOM_IDS.CANNED_EDITOR_BODY);

  if (!modal || !form) return;

  // Reset form
  form.reset();

  if (response) {
    // Edit mode
    title.textContent = 'Edit Canned Response';
    modal.dataset.editId = response.id;
    idInput.value = response.id || '';
    idInput.readOnly = true; // Don't allow changing ID of existing response
    titleInput.value = response.title || '';
    categoriesInput.value = response.categories?.join(', ') || '';
    descriptionInput.value = response.description || '';
    bodyInput.value = response.bodyTemplate || '';
  } else {
    // New mode
    title.textContent = 'New Canned Response';
    delete modal.dataset.editId;
    idInput.readOnly = false;
  }

  modal.hidden = false;
  titleInput.focus();
}

/**
 * Close the canned response editor modal.
 */
export function closeCannedEditor() {
  const modal = getElement(DOM_IDS.CANNED_EDITOR_MODAL);
  if (modal) {
    modal.hidden = true;
    delete modal.dataset.editId;
  }
}

/**
 * Get the form data from the canned response editor.
 * @returns {Object} Form data
 */
export function getCannedEditorFormData() {
  const modal = getElement(DOM_IDS.CANNED_EDITOR_MODAL);
  const idInput = getElement(DOM_IDS.CANNED_EDITOR_ID);
  const titleInput = getElement(DOM_IDS.CANNED_EDITOR_TITLE_INPUT);
  const categoriesInput = getElement(DOM_IDS.CANNED_EDITOR_CATEGORIES);
  const descriptionInput = getElement(DOM_IDS.CANNED_EDITOR_DESCRIPTION);
  const bodyInput = getElement(DOM_IDS.CANNED_EDITOR_BODY);

  const categoriesRaw = categoriesInput?.value || '';
  const categories = categoriesRaw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c);

  return {
    id: idInput?.value?.trim() || '',
    title: titleInput?.value?.trim() || '',
    categories,
    description: descriptionInput?.value?.trim() || '',
    bodyTemplate: bodyInput?.value || '',
    isEditing: !!modal?.dataset.editId,
    originalId: modal?.dataset.editId || null,
  };
}

/**
 * Validate the canned editor form.
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateCannedEditorForm() {
  const data = getCannedEditorFormData();
  const errors = [];

  if (!data.title) {
    errors.push('Title is required');
  }

  if (!data.bodyTemplate) {
    errors.push('Response body is required');
  }

  if (data.id && !/^[a-z0-9-]+$/.test(data.id)) {
    errors.push('ID must contain only lowercase letters, numbers, and hyphens');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Download an HTML test page to the user's browser.
 * @param {string} htmlContent - The HTML content to download
 * @param {string|number} bugId - Bug ID for the filename
 * @returns {string} The blob URL that can be used to open the page
 */
export function downloadTestPage(htmlContent, bugId) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Create download link and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `bug${bugId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Return the URL so it can be used to open the page
  return url;
}

/**
 * Show a test page link in the bug row.
 * @param {string|number} bugId - Bug ID
 * @param {string} blobUrl - Blob URL to the test page
 * @param {string} reason - Reason/description from AI
 */
export function showTestPageLink(bugId, blobUrl, reason) {
  const row = document.querySelector(`tr[data-bug-id="${bugId}"]`);
  if (!row) return;

  const actionsCell = row.querySelector('.actions-cell, td:last-child');
  if (!actionsCell) return;

  // Remove existing test page link if any
  const existing = actionsCell.querySelector('.testpage-link');
  if (existing) existing.remove();

  // Create link container
  const linkContainer = document.createElement('span');
  linkContainer.className = 'testpage-link';
  linkContainer.innerHTML = `
    <a href="${blobUrl}" target="_blank" class="btn-test-page" title="${reason || 'Open test page'}">
      Open Test
    </a>
  `;
  actionsCell.appendChild(linkContainer);
}

/**
 * Update a bug row to show test page generation is in progress.
 * @param {string|number} bugId - Bug ID
 */
export function showTestPageLoading(bugId) {
  const row = document.querySelector(`tr[data-bug-id="${bugId}"]`);
  if (!row) return;

  const actionsCell = row.querySelector('.actions-cell, td:last-child');
  if (!actionsCell) return;

  // Remove existing test page elements
  const existing = actionsCell.querySelector('.testpage-link, .testpage-loading');
  if (existing) existing.remove();

  const loading = document.createElement('span');
  loading.className = 'testpage-loading';
  loading.textContent = 'Generating...';
  actionsCell.appendChild(loading);
}

/**
 * Clear test page loading state from a bug row.
 * @param {string|number} bugId - Bug ID
 */
export function clearTestPageLoading(bugId) {
  const row = document.querySelector(`tr[data-bug-id="${bugId}"]`);
  if (!row) return;

  const actionsCell = row.querySelector('.actions-cell, td:last-child');
  if (!actionsCell) return;

  const loading = actionsCell.querySelector('.testpage-loading');
  if (loading) loading.remove();
}

console.log('[ui] Module loaded');
