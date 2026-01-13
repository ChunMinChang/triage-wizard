/**
 * @fileoverview Tests for ui module (DOM rendering)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderBugTable,
  renderBugRow,
  renderTags,
  setLoading,
  showToast,
  showError,
  showSuccess,
  showInfo,
  toggleSummary,
  updateFilterControls,
  updateBugCount,
  clearBugTable,
  sortBugs,
  DOM_IDS,
} from '../ui.js';

describe('ui module', () => {
  // Set up DOM before each test
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="bug-table-container">
        <table id="bug-table">
          <thead>
            <tr>
              <th scope="col" data-sort="id">ID</th>
              <th scope="col" data-sort="status">Status</th>
              <th scope="col" data-sort="product">Product</th>
              <th scope="col" data-sort="component">Component</th>
              <th scope="col" data-sort="summary">Summary</th>
              <th scope="col">Tags</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody id="bug-table-body"></tbody>
        </table>
        <p id="empty-state" class="empty-state">No bugs loaded.</p>
      </div>
      <span id="bug-count"></span>
      <div id="loading-overlay" class="loading-overlay" hidden>
        <div class="spinner"></div>
        <p id="loading-message">Loading...</p>
      </div>
      <div id="toast-container" class="toast-container" aria-live="polite"></div>
      <div id="include-tags" class="tag-checkboxes"></div>
      <div id="exclude-tags" class="tag-checkboxes"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('DOM_IDS', () => {
    it('should export all required DOM IDs', () => {
      expect(DOM_IDS.BUG_TABLE).toBe('bug-table');
      expect(DOM_IDS.BUG_TABLE_BODY).toBe('bug-table-body');
      expect(DOM_IDS.EMPTY_STATE).toBe('empty-state');
      expect(DOM_IDS.LOADING_OVERLAY).toBe('loading-overlay');
      expect(DOM_IDS.LOADING_MESSAGE).toBe('loading-message');
      expect(DOM_IDS.TOAST_CONTAINER).toBe('toast-container');
      expect(DOM_IDS.BUG_COUNT).toBe('bug-count');
    });
  });

  describe('renderBugTable', () => {
    const mockBugs = [
      {
        id: 123456,
        summary: 'Test bug 1',
        status: 'NEW',
        product: 'Firefox',
        component: 'General',
        tags: [],
      },
      {
        id: 234567,
        summary: 'Test bug 2',
        status: 'ASSIGNED',
        product: 'Core',
        component: 'JavaScript Engine',
        tags: [{ id: 'has-str', label: 'Has STR' }],
      },
    ];

    it('should render bugs into the table body', () => {
      renderBugTable(mockBugs);

      const tbody = document.getElementById('bug-table-body');
      expect(tbody.children.length).toBe(2);
    });

    it('should hide empty state when bugs are present', () => {
      renderBugTable(mockBugs);

      const emptyState = document.getElementById('empty-state');
      expect(emptyState.hidden).toBe(true);
    });

    it('should show empty state when no bugs', () => {
      renderBugTable([]);

      const emptyState = document.getElementById('empty-state');
      expect(emptyState.hidden).toBe(false);
    });

    it('should update bug count', () => {
      renderBugTable(mockBugs);

      const bugCount = document.getElementById('bug-count');
      expect(bugCount.textContent).toContain('2');
    });

    it('should clear existing rows before rendering', () => {
      renderBugTable(mockBugs);
      renderBugTable([mockBugs[0]]);

      const tbody = document.getElementById('bug-table-body');
      expect(tbody.children.length).toBe(1);
    });

    it('should render bug ID as link to Bugzilla', () => {
      renderBugTable(mockBugs);

      const tbody = document.getElementById('bug-table-body');
      const firstRow = tbody.children[0];
      const idCell = firstRow.querySelector('td:first-child a');

      expect(idCell).not.toBeNull();
      expect(idCell.href).toContain('123456');
      expect(idCell.target).toBe('_blank');
    });

    it('should render all bug columns', () => {
      renderBugTable([mockBugs[0]]);

      const tbody = document.getElementById('bug-table-body');
      const row = tbody.children[0];
      const cells = row.querySelectorAll('td');

      expect(cells.length).toBe(7); // ID, Status, Product, Component, Summary, Tags, Actions
    });
  });

  describe('renderBugRow', () => {
    const mockBug = {
      id: 123456,
      summary: 'Test bug summary',
      status: 'NEW',
      product: 'Firefox',
      component: 'General',
      tags: [],
    };

    it('should create a table row element', () => {
      const row = renderBugRow(mockBug);
      expect(row.tagName).toBe('TR');
    });

    it('should set data-bug-id attribute', () => {
      const row = renderBugRow(mockBug);
      expect(row.dataset.bugId).toBe('123456');
    });

    it('should render bug ID with link', () => {
      const row = renderBugRow(mockBug);
      const idLink = row.querySelector('td:first-child a');

      expect(idLink.textContent).toBe('123456');
      expect(idLink.href).toContain('bugzilla.mozilla.org');
    });

    it('should render status cell', () => {
      const row = renderBugRow(mockBug);
      const cells = row.querySelectorAll('td');

      expect(cells[1].textContent).toBe('NEW');
    });

    it('should render product and component', () => {
      const row = renderBugRow(mockBug);
      const cells = row.querySelectorAll('td');

      expect(cells[2].textContent).toBe('Firefox');
      expect(cells[3].textContent).toBe('General');
    });

    it('should render summary with truncation for long text', () => {
      const longBug = {
        ...mockBug,
        summary: 'A'.repeat(200),
      };
      const row = renderBugRow(longBug);
      const summaryCell = row.querySelectorAll('td')[4];

      expect(summaryCell.textContent.length).toBeLessThanOrEqual(150);
    });

    it('should render tags container', () => {
      const row = renderBugRow(mockBug);
      const tagsCell = row.querySelectorAll('td')[5];

      expect(tagsCell.querySelector('.tags-container')).not.toBeNull();
    });

    it('should render actions cell with buttons', () => {
      const row = renderBugRow(mockBug);
      const actionsCell = row.querySelectorAll('td')[6];

      expect(actionsCell.querySelector('button')).not.toBeNull();
    });
  });

  describe('renderTags', () => {
    it('should return a container element', () => {
      const container = renderTags([]);
      expect(container.classList.contains('tags-container')).toBe(true);
    });

    it('should render tag badges', () => {
      const tags = [
        { id: 'has-str', label: 'Has STR' },
        { id: 'test-attached', label: 'test-attached' },
      ];
      const container = renderTags(tags);

      const badges = container.querySelectorAll('.tag-badge');
      expect(badges.length).toBe(2);
    });

    it('should set correct CSS class for tag type', () => {
      const tags = [{ id: 'has-str', label: 'Has STR' }];
      const container = renderTags(tags);

      const badge = container.querySelector('.tag-badge');
      expect(badge.classList.contains('tag-has-str')).toBe(true);
    });

    it('should set tooltip with evidence if provided', () => {
      const tags = [
        { id: 'has-str', label: 'Has STR', evidence: 'cf_has_str = yes' },
      ];
      const container = renderTags(tags);

      const badge = container.querySelector('.tag-badge');
      expect(badge.title).toBe('cf_has_str = yes');
    });

    it('should handle empty tags array', () => {
      const container = renderTags([]);
      expect(container.children.length).toBe(0);
    });

    it('should handle null/undefined tags', () => {
      expect(() => renderTags(null)).not.toThrow();
      expect(() => renderTags(undefined)).not.toThrow();
    });
  });

  describe('setLoading', () => {
    it('should show loading overlay when true', () => {
      setLoading(true);

      const overlay = document.getElementById('loading-overlay');
      expect(overlay.hidden).toBe(false);
    });

    it('should hide loading overlay when false', () => {
      setLoading(true);
      setLoading(false);

      const overlay = document.getElementById('loading-overlay');
      expect(overlay.hidden).toBe(true);
    });

    it('should update loading message', () => {
      setLoading(true, 'Fetching bugs...');

      const message = document.getElementById('loading-message');
      expect(message.textContent).toBe('Fetching bugs...');
    });

    it('should use default message if not provided', () => {
      setLoading(true);

      const message = document.getElementById('loading-message');
      expect(message.textContent).toBe('Loading...');
    });
  });

  describe('showToast', () => {
    it('should add toast to container', () => {
      showToast('Test message', 'info');

      const container = document.getElementById('toast-container');
      expect(container.children.length).toBe(1);
    });

    it('should set correct toast type class', () => {
      showToast('Error!', 'error');

      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-error')).toBe(true);
    });

    it('should display the message', () => {
      showToast('Hello world', 'success');

      const toast = document.querySelector('.toast');
      expect(toast.textContent).toBe('Hello world');
    });

    it('should auto-remove toast after duration', async () => {
      vi.useFakeTimers();

      showToast('Temporary', 'info', 1000);

      expect(document.querySelectorAll('.toast').length).toBe(1);

      vi.advanceTimersByTime(1500);

      expect(document.querySelectorAll('.toast').length).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('showError', () => {
    it('should show error toast', () => {
      showError('Something went wrong');

      const toast = document.querySelector('.toast-error');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Something went wrong');
    });
  });

  describe('showSuccess', () => {
    it('should show success toast', () => {
      showSuccess('Operation completed');

      const toast = document.querySelector('.toast-success');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Operation completed');
    });
  });

  describe('showInfo', () => {
    it('should show info toast', () => {
      showInfo('FYI');

      const toast = document.querySelector('.toast-info');
      expect(toast).not.toBeNull();
    });
  });

  describe('toggleSummary', () => {
    beforeEach(() => {
      // Add a bug row to toggle
      const tbody = document.getElementById('bug-table-body');
      const row = document.createElement('tr');
      row.dataset.bugId = '123456';
      row.innerHTML = '<td colspan="7">Bug row</td>';
      tbody.appendChild(row);
    });

    it('should insert summary row after bug row', () => {
      toggleSummary(123456, 'This is the summary');

      const tbody = document.getElementById('bug-table-body');
      expect(tbody.children.length).toBe(2);

      const summaryRow = tbody.children[1];
      expect(summaryRow.classList.contains('summary-row')).toBe(true);
    });

    it('should remove summary row if already expanded', () => {
      toggleSummary(123456, 'Summary');
      toggleSummary(123456, 'Summary');

      const tbody = document.getElementById('bug-table-body');
      expect(tbody.children.length).toBe(1);
    });

    it('should display summary content', () => {
      toggleSummary(123456, 'This is the AI summary');

      const summaryRow = document.querySelector('.summary-row');
      expect(summaryRow.textContent).toContain('This is the AI summary');
    });

    it('should handle missing bug row gracefully', () => {
      expect(() => toggleSummary(999999, 'Summary')).not.toThrow();
    });
  });

  describe('updateFilterControls', () => {
    const availableTags = ['has-str', 'test-attached', 'crashstack'];

    it('should populate include tags checkboxes', () => {
      updateFilterControls(availableTags, {});

      const includeTags = document.getElementById('include-tags');
      const checkboxes = includeTags.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(3);
    });

    it('should populate exclude tags checkboxes', () => {
      updateFilterControls(availableTags, {});

      const excludeTags = document.getElementById('exclude-tags');
      const checkboxes = excludeTags.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(3);
    });

    it('should check boxes based on current filter', () => {
      updateFilterControls(availableTags, {
        include: ['has-str'],
        exclude: ['crashstack'],
      });

      const includeHasStr = document.querySelector(
        '#include-tags input[value="has-str"]'
      );
      const excludeCrashstack = document.querySelector(
        '#exclude-tags input[value="crashstack"]'
      );

      expect(includeHasStr.checked).toBe(true);
      expect(excludeCrashstack.checked).toBe(true);
    });

    it('should clear existing checkboxes before rendering', () => {
      updateFilterControls(availableTags, {});
      updateFilterControls(['has-str'], {});

      const includeTags = document.getElementById('include-tags');
      const checkboxes = includeTags.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(1);
    });
  });

  describe('updateBugCount', () => {
    it('should update bug count display', () => {
      updateBugCount(5);

      const countEl = document.getElementById('bug-count');
      expect(countEl.textContent).toContain('5');
    });

    it('should show singular for count of 1', () => {
      updateBugCount(1);

      const countEl = document.getElementById('bug-count');
      expect(countEl.textContent).toContain('1 bug');
    });

    it('should show plural for count > 1', () => {
      updateBugCount(3);

      const countEl = document.getElementById('bug-count');
      expect(countEl.textContent).toContain('3 bugs');
    });

    it('should handle zero bugs', () => {
      updateBugCount(0);

      const countEl = document.getElementById('bug-count');
      expect(countEl.textContent).toBe('');
    });
  });

  describe('clearBugTable', () => {
    it('should remove all rows from table body', () => {
      const tbody = document.getElementById('bug-table-body');
      tbody.innerHTML = '<tr><td>Row 1</td></tr><tr><td>Row 2</td></tr>';

      clearBugTable();

      expect(tbody.children.length).toBe(0);
    });

    it('should show empty state', () => {
      clearBugTable();

      const emptyState = document.getElementById('empty-state');
      expect(emptyState.hidden).toBe(false);
    });

    it('should clear bug count', () => {
      updateBugCount(5);
      clearBugTable();

      const countEl = document.getElementById('bug-count');
      expect(countEl.textContent).toBe('');
    });
  });

  describe('sortBugs', () => {
    const bugs = [
      { id: 3, summary: 'Bug C', status: 'NEW', product: 'Firefox' },
      { id: 1, summary: 'Bug A', status: 'ASSIGNED', product: 'Core' },
      { id: 2, summary: 'Bug B', status: 'NEW', product: 'Firefox' },
    ];

    it('should sort by id ascending', () => {
      const sorted = sortBugs([...bugs], 'id', 'asc');
      expect(sorted[0].id).toBe(1);
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(3);
    });

    it('should sort by id descending', () => {
      const sorted = sortBugs([...bugs], 'id', 'desc');
      expect(sorted[0].id).toBe(3);
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(1);
    });

    it('should sort by string field', () => {
      const sorted = sortBugs([...bugs], 'summary', 'asc');
      expect(sorted[0].summary).toBe('Bug A');
      expect(sorted[1].summary).toBe('Bug B');
      expect(sorted[2].summary).toBe('Bug C');
    });

    it('should sort by status', () => {
      const sorted = sortBugs([...bugs], 'status', 'asc');
      expect(sorted[0].status).toBe('ASSIGNED');
    });

    it('should not modify original array', () => {
      const original = [...bugs];
      sortBugs(bugs, 'id', 'asc');
      expect(bugs[0].id).toBe(original[0].id);
    });
  });

  describe('accessibility', () => {
    it('should have proper table structure', () => {
      const table = document.getElementById('bug-table');
      expect(table.querySelector('thead')).not.toBeNull();
      expect(table.querySelector('tbody')).not.toBeNull();
    });

    it('should have scope on header cells', () => {
      const headers = document.querySelectorAll('#bug-table th');
      headers.forEach((th) => {
        expect(th.getAttribute('scope')).toBe('col');
      });
    });

    it('should have aria-live on toast container', () => {
      const container = document.getElementById('toast-container');
      expect(container.getAttribute('aria-live')).toBe('polite');
    });
  });
});
