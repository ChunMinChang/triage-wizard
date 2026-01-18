/**
 * @fileoverview Tests for ui module (DOM rendering)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderBugTable,
  renderBugRow,
  renderTags,
  renderTagsWithSuggestion,
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
  renderCannedResponseCard,
  renderCannedResponsesList,
  updateCannedCategoryFilter,
  extractCategories,
  openResponseComposer,
  closeResponseComposer,
  getComposerBugId,
  getComposerResponseBody,
  setComposerResponseBody,
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

    it('should render "Set Has STR" button when hasStrSuggested is true', () => {
      const bugWithSuggestion = {
        ...mockBug,
        tags: [{ id: 'test-attached', label: 'test-attached' }],
        hasStrSuggested: true,
      };
      const row = renderBugRow(bugWithSuggestion);
      const tagsCell = row.querySelectorAll('td')[5];

      const setHasStrBtn = tagsCell.querySelector('.btn-set-has-str');
      expect(setHasStrBtn).not.toBeNull();
      expect(setHasStrBtn.textContent).toBe('Set Has STR');
      expect(setHasStrBtn.dataset.bugId).toBe('123456');
    });

    it('should NOT render "Set Has STR" button when hasStrSuggested is false', () => {
      const bugWithoutSuggestion = {
        ...mockBug,
        tags: [{ id: 'crashstack', label: 'crashstack' }],
        hasStrSuggested: false,
      };
      const row = renderBugRow(bugWithoutSuggestion);
      const tagsCell = row.querySelectorAll('td')[5];

      const setHasStrBtn = tagsCell.querySelector('.btn-set-has-str');
      expect(setHasStrBtn).toBeNull();
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

  describe('renderTagsWithSuggestion', () => {
    it('should render tags without suggestion button when hasStrSuggested is false', () => {
      const tags = [{ id: 'test-attached', label: 'test-attached' }];
      const container = renderTagsWithSuggestion(tags, false);

      expect(container.querySelector('.tag-badge')).not.toBeNull();
      expect(container.querySelector('.btn-set-has-str')).toBeNull();
    });

    it('should render "Set Has STR" button when hasStrSuggested is true', () => {
      const tags = [{ id: 'test-attached', label: 'test-attached' }];
      const container = renderTagsWithSuggestion(tags, true);

      const btn = container.querySelector('.btn-set-has-str');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Set Has STR');
    });

    it('should not show button if Has STR tag is already present', () => {
      const tags = [
        { id: 'has-str', label: 'Has STR' },
        { id: 'test-attached', label: 'test-attached' },
      ];
      const container = renderTagsWithSuggestion(tags, false);

      expect(container.querySelector('.btn-set-has-str')).toBeNull();
    });

    it('should set correct data attributes on button', () => {
      const tags = [{ id: 'test-attached', label: 'test-attached' }];
      const bugId = 123456;
      const container = renderTagsWithSuggestion(tags, true, bugId);

      const btn = container.querySelector('.btn-set-has-str');
      expect(btn.dataset.action).toBe('set-has-str');
      expect(btn.dataset.bugId).toBe(String(bugId));
    });

    it('should handle empty tags with suggestion', () => {
      const container = renderTagsWithSuggestion([], true, 123);

      const btn = container.querySelector('.btn-set-has-str');
      expect(btn).not.toBeNull();
    });
  });

  describe('AI tag styling', () => {
    it('should apply AI tag class for AI-detected STR', () => {
      const tags = [{ id: 'ai-detected-str', label: 'AI-detected STR' }];
      const container = renderTags(tags);

      const badge = container.querySelector('.tag-badge');
      expect(badge.classList.contains('tag-ai-detected-str')).toBe(true);
    });

    it('should apply AI tag class for AI-detected test-attached', () => {
      const tags = [{ id: 'ai-detected-test-attached', label: 'AI-detected test-attached' }];
      const container = renderTags(tags);

      const badge = container.querySelector('.tag-badge');
      expect(badge.classList.contains('tag-ai-detected-test-attached')).toBe(true);
    });
  });

  describe('canned responses UI', () => {
    beforeEach(() => {
      document.body.innerHTML += `
        <div id="canned-responses-list"></div>
        <select id="canned-category-filter">
          <option value="">All categories</option>
        </select>
      `;
    });

    describe('renderCannedResponseCard', () => {
      it('should create a card with title and id', () => {
        const response = {
          id: 'need-str',
          title: 'Ask for STR',
          bodyTemplate: 'Please provide steps to reproduce.',
        };

        const card = renderCannedResponseCard(response);

        expect(card.className).toBe('canned-response-card');
        expect(card.dataset.responseId).toBe('need-str');
        expect(card.querySelector('.canned-response-title').textContent).toBe('Ask for STR');
        expect(card.querySelector('.canned-response-id').textContent).toBe('need-str');
      });

      it('should render categories as badges', () => {
        const response = {
          id: 'test',
          title: 'Test',
          categories: ['need-info', 'str'],
          bodyTemplate: 'Body',
        };

        const card = renderCannedResponseCard(response);
        const badges = card.querySelectorAll('.category-badge');

        expect(badges.length).toBe(2);
        expect(badges[0].textContent).toBe('need-info');
        expect(badges[1].textContent).toBe('str');
      });

      it('should render description if present', () => {
        const response = {
          id: 'test',
          title: 'Test',
          description: 'This is a description',
          bodyTemplate: 'Body',
        };

        const card = renderCannedResponseCard(response);
        const desc = card.querySelector('.canned-response-description');

        expect(desc).not.toBeNull();
        expect(desc.textContent).toBe('This is a description');
      });

      it('should not render description if not present', () => {
        const response = {
          id: 'test',
          title: 'Test',
          bodyTemplate: 'Body',
        };

        const card = renderCannedResponseCard(response);
        expect(card.querySelector('.canned-response-description')).toBeNull();
      });

      it('should render copy and delete buttons', () => {
        const response = {
          id: 'test',
          title: 'Test',
          bodyTemplate: 'Body',
        };

        const card = renderCannedResponseCard(response);
        const copyBtn = card.querySelector('button[data-action="copy"]');
        const deleteBtn = card.querySelector('button[data-action="delete"]');

        expect(copyBtn).not.toBeNull();
        expect(deleteBtn).not.toBeNull();
        expect(copyBtn.dataset.responseId).toBe('test');
        expect(deleteBtn.dataset.responseId).toBe('test');
      });
    });

    describe('renderCannedResponsesList', () => {
      it('should render multiple response cards', () => {
        const responses = [
          { id: 'r1', title: 'Response 1', bodyTemplate: 'Body 1' },
          { id: 'r2', title: 'Response 2', bodyTemplate: 'Body 2' },
          { id: 'r3', title: 'Response 3', bodyTemplate: 'Body 3' },
        ];

        renderCannedResponsesList(responses);

        const container = document.getElementById('canned-responses-list');
        const cards = container.querySelectorAll('.canned-response-card');
        expect(cards.length).toBe(3);
      });

      it('should show empty state when no responses', () => {
        renderCannedResponsesList([]);

        const container = document.getElementById('canned-responses-list');
        const emptyState = container.querySelector('.empty-state');
        expect(emptyState).not.toBeNull();
        expect(emptyState.textContent).toContain('No canned responses');
      });

      it('should clear previous content', () => {
        const container = document.getElementById('canned-responses-list');
        container.innerHTML = '<div class="old-content">Old</div>';

        renderCannedResponsesList([{ id: 'new', title: 'New', bodyTemplate: 'New' }]);

        expect(container.querySelector('.old-content')).toBeNull();
        expect(container.querySelectorAll('.canned-response-card').length).toBe(1);
      });
    });

    describe('updateCannedCategoryFilter', () => {
      it('should add category options to select', () => {
        // Categories should be passed in sorted order (from extractCategories)
        updateCannedCategoryFilter(['need-info', 'resolution', 'str']);

        const select = document.getElementById('canned-category-filter');
        expect(select.options.length).toBe(4); // "All" + 3 categories
        expect(select.options[1].value).toBe('need-info');
        expect(select.options[2].value).toBe('resolution');
        expect(select.options[3].value).toBe('str');
      });

      it('should select the provided category', () => {
        updateCannedCategoryFilter(['cat-a', 'cat-b'], 'cat-b');

        const select = document.getElementById('canned-category-filter');
        expect(select.value).toBe('cat-b');
      });

      it('should preserve first option', () => {
        updateCannedCategoryFilter(['cat-a']);

        const select = document.getElementById('canned-category-filter');
        expect(select.options[0].value).toBe('');
        expect(select.options[0].textContent).toBe('All categories');
      });
    });

    describe('extractCategories', () => {
      it('should extract unique categories from responses', () => {
        const responses = [
          { id: 'r1', categories: ['cat-a', 'cat-b'] },
          { id: 'r2', categories: ['cat-b', 'cat-c'] },
          { id: 'r3', categories: ['cat-a'] },
        ];

        const categories = extractCategories(responses);

        expect(categories).toEqual(['cat-a', 'cat-b', 'cat-c']);
      });

      it('should return sorted categories', () => {
        const responses = [
          { id: 'r1', categories: ['zebra', 'apple'] },
        ];

        const categories = extractCategories(responses);
        expect(categories).toEqual(['apple', 'zebra']);
      });

      it('should handle responses without categories', () => {
        const responses = [
          { id: 'r1' },
          { id: 'r2', categories: ['cat-a'] },
        ];

        const categories = extractCategories(responses);
        expect(categories).toEqual(['cat-a']);
      });

      it('should return empty array for empty input', () => {
        expect(extractCategories([])).toEqual([]);
        expect(extractCategories(null)).toEqual([]);
      });
    });
  });

  describe('response composer', () => {
    beforeEach(() => {
      document.body.innerHTML += `
        <div id="response-composer-modal" hidden>
          <span id="composer-bug-id"></span>
          <select id="canned-response-select">
            <option value="">-- Choose a response --</option>
          </select>
          <textarea id="response-body"></textarea>
        </div>
      `;
    });

    describe('openResponseComposer', () => {
      it('should show the modal', () => {
        const bug = { id: 123456 };
        openResponseComposer(bug, []);

        const modal = document.getElementById('response-composer-modal');
        expect(modal.hidden).toBe(false);
      });

      it('should set the bug ID', () => {
        const bug = { id: 123456 };
        openResponseComposer(bug, []);

        const bugIdSpan = document.getElementById('composer-bug-id');
        expect(bugIdSpan.textContent).toBe('Bug 123456');
        expect(bugIdSpan.dataset.bugId).toBe('123456');
      });

      it('should populate canned responses dropdown', () => {
        const bug = { id: 123 };
        const responses = [
          { id: 'r1', title: 'Response One' },
          { id: 'r2', title: 'Response Two' },
        ];

        openResponseComposer(bug, responses);

        const select = document.getElementById('canned-response-select');
        expect(select.options.length).toBe(3); // empty + 2 responses
        expect(select.options[1].value).toBe('r1');
        expect(select.options[1].textContent).toBe('Response One');
        expect(select.options[2].value).toBe('r2');
      });

      it('should clear the response body', () => {
        const textarea = document.getElementById('response-body');
        textarea.value = 'previous text';

        openResponseComposer({ id: 123 }, []);

        expect(textarea.value).toBe('');
      });
    });

    describe('closeResponseComposer', () => {
      it('should hide the modal', () => {
        const modal = document.getElementById('response-composer-modal');
        modal.hidden = false;

        closeResponseComposer();

        expect(modal.hidden).toBe(true);
      });
    });

    describe('getComposerBugId', () => {
      it('should return the bug ID from data attribute', () => {
        const bugIdSpan = document.getElementById('composer-bug-id');
        bugIdSpan.dataset.bugId = '999';

        expect(getComposerBugId()).toBe('999');
      });

      it('should return null if no bug ID set', () => {
        expect(getComposerBugId()).toBe(null);
      });
    });

    describe('getComposerResponseBody', () => {
      it('should return the textarea value', () => {
        const textarea = document.getElementById('response-body');
        textarea.value = 'Hello world';

        expect(getComposerResponseBody()).toBe('Hello world');
      });

      it('should return empty string if empty', () => {
        expect(getComposerResponseBody()).toBe('');
      });
    });

    describe('setComposerResponseBody', () => {
      it('should set the textarea value', () => {
        setComposerResponseBody('New response text');

        const textarea = document.getElementById('response-body');
        expect(textarea.value).toBe('New response text');
      });
    });
  });
});
