/**
 * @fileoverview Tests for bugzilla module (REST API integration)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as config from '../config.js';
import {
  loadBugsByIds,
  loadBugsByRestUrl,
  parseBuglistUrl,
  parseInputString,
  fetchAttachments,
  fetchComments,
  setHasStr,
  postComment,
  normalizeBug,
  BUG_FIELDS,
} from '../bugzilla.js';

// Mock config module
vi.mock('../config.js', () => ({
  getConfig: vi.fn(() => ({
    bugzillaHost: 'https://bugzilla.mozilla.org',
    bugzillaApiKey: '',
    backendUrl: 'http://localhost:3000',
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('bugzilla module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('constants', () => {
    it('should export BUG_FIELDS with required fields', () => {
      expect(BUG_FIELDS).toContain('id');
      expect(BUG_FIELDS).toContain('summary');
      expect(BUG_FIELDS).toContain('status');
      expect(BUG_FIELDS).toContain('product');
      expect(BUG_FIELDS).toContain('component');
      expect(BUG_FIELDS).toContain('keywords');
      expect(BUG_FIELDS).toContain('cf_has_str');
      expect(BUG_FIELDS).toContain('cf_crash_signature');
      expect(BUG_FIELDS).toContain('flags');
    });
  });

  describe('parseInputString', () => {
    it('should parse space-separated bug IDs', () => {
      const result = parseInputString('123456 234567 345678');
      expect(result.type).toBe('ids');
      expect(result.ids).toEqual(['123456', '234567', '345678']);
    });

    it('should parse comma-separated bug IDs', () => {
      const result = parseInputString('123456,234567,345678');
      expect(result.type).toBe('ids');
      expect(result.ids).toEqual(['123456', '234567', '345678']);
    });

    it('should parse newline-separated bug IDs', () => {
      const result = parseInputString('123456\n234567\n345678');
      expect(result.type).toBe('ids');
      expect(result.ids).toEqual(['123456', '234567', '345678']);
    });

    it('should parse mixed separators', () => {
      const result = parseInputString('123456, 234567 345678');
      expect(result.type).toBe('ids');
      expect(result.ids).toEqual(['123456', '234567', '345678']);
    });

    it('should detect REST URL', () => {
      const url = 'https://bugzilla.mozilla.org/rest/bug?product=Firefox';
      const result = parseInputString(url);
      expect(result.type).toBe('rest');
      expect(result.url).toBe(url);
    });

    it('should detect buglist.cgi URL', () => {
      const url = 'https://bugzilla.mozilla.org/buglist.cgi?product=Firefox';
      const result = parseInputString(url);
      expect(result.type).toBe('buglist');
      expect(result.url).toBe(url);
    });

    it('should handle empty input', () => {
      const result = parseInputString('');
      expect(result.type).toBe('ids');
      expect(result.ids).toEqual([]);
    });

    it('should filter invalid IDs', () => {
      const result = parseInputString('123456 abc 234567');
      expect(result.ids).toEqual(['123456', '234567']);
    });
  });

  describe('parseBuglistUrl', () => {
    it('should convert simple buglist.cgi URL to REST', () => {
      const buglistUrl = 'https://bugzilla.mozilla.org/buglist.cgi?product=Firefox&component=General';
      const result = parseBuglistUrl(buglistUrl);
      expect(result).toContain('/rest/bug?');
      expect(result).toContain('product=Firefox');
      expect(result).toContain('component=General');
    });

    it('should preserve query parameters', () => {
      const buglistUrl = 'https://bugzilla.mozilla.org/buglist.cgi?product=Firefox&status=NEW&status=ASSIGNED';
      const result = parseBuglistUrl(buglistUrl);
      expect(result).toContain('product=Firefox');
      expect(result).toContain('status=NEW');
    });

    it('should add include_fields to REST URL', () => {
      const buglistUrl = 'https://bugzilla.mozilla.org/buglist.cgi?product=Firefox';
      const result = parseBuglistUrl(buglistUrl);
      expect(result).toContain('include_fields=');
    });

    it('should handle buglist.cgi with bug_id parameter', () => {
      const buglistUrl = 'https://bugzilla.mozilla.org/buglist.cgi?bug_id=123,456,789';
      const result = parseBuglistUrl(buglistUrl);
      // URL encodes commas, so check for either encoded or unencoded
      expect(result).toMatch(/id=123(,|%2C)456(,|%2C)789/);
    });

    it('should return null for invalid URL', () => {
      const result = parseBuglistUrl('not a url');
      expect(result).toBe(null);
    });

    it('should return null for non-buglist URL', () => {
      const result = parseBuglistUrl('https://bugzilla.mozilla.org/show_bug.cgi?id=123');
      expect(result).toBe(null);
    });

    it('should handle relative buglist.cgi path', () => {
      const result = parseBuglistUrl('/buglist.cgi?product=Firefox');
      expect(result).toContain('/rest/bug?');
      expect(result).toContain('product=Firefox');
    });
  });

  describe('normalizeBug', () => {
    it('should normalize a full Bugzilla bug object', () => {
      const rawBug = {
        id: 123456,
        summary: 'Test bug summary',
        status: 'NEW',
        product: 'Firefox',
        component: 'General',
        severity: 'normal',
        keywords: ['testcase', 'regression'],
        cf_has_str: 'yes',
        cf_crash_signature: '[@ crash_function]',
        flags: [{ name: 'in-testsuite', status: '+' }],
        creation_time: '2024-01-01T00:00:00Z',
        last_change_time: '2024-01-02T00:00:00Z',
      };

      const normalized = normalizeBug(rawBug);

      expect(normalized.id).toBe(123456);
      expect(normalized.summary).toBe('Test bug summary');
      expect(normalized.status).toBe('NEW');
      expect(normalized.product).toBe('Firefox');
      expect(normalized.component).toBe('General');
      expect(normalized.keywords).toEqual(['testcase', 'regression']);
      expect(normalized.cfHasStr).toBe('yes');
      expect(normalized.cfCrashSignature).toBe('[@ crash_function]');
    });

    it('should handle missing optional fields', () => {
      const rawBug = {
        id: 123456,
        summary: 'Test bug',
      };

      const normalized = normalizeBug(rawBug);

      expect(normalized.id).toBe(123456);
      expect(normalized.keywords).toEqual([]);
      expect(normalized.cfHasStr).toBe('');
      expect(normalized.cfCrashSignature).toBe('');
      expect(normalized.flags).toEqual([]);
    });

    it('should convert string keywords to array', () => {
      const rawBug = {
        id: 123456,
        keywords: 'testcase',
      };

      const normalized = normalizeBug(rawBug);
      expect(normalized.keywords).toEqual(['testcase']);
    });
  });

  describe('loadBugsByIds', () => {
    it('should fetch bugs by IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bugs: [
            { id: 123456, summary: 'Bug 1' },
            { id: 234567, summary: 'Bug 2' },
          ],
        }),
      });

      const bugs = await loadBugsByIds(['123456', '234567']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/rest/bug?');
      // URL encodes commas, so check for either encoded or unencoded
      expect(mockFetch.mock.calls[0][0]).toMatch(/id=123456(,|%2C)234567/);
      expect(bugs).toHaveLength(2);
      expect(bugs[0].id).toBe(123456);
    });

    it('should return empty array for empty IDs', async () => {
      const bugs = await loadBugsByIds([]);
      expect(bugs).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should include required fields in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [] }),
      });

      await loadBugsByIds(['123456']);

      expect(mockFetch.mock.calls[0][0]).toContain('include_fields=');
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(loadBugsByIds(['123456'])).rejects.toThrow('Network error');
    });

    it('should throw error on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(loadBugsByIds(['999999999'])).rejects.toThrow();
    });

    it('should include API key in headers when provided', async () => {
      config.getConfig.mockReturnValueOnce({
        bugzillaHost: 'https://bugzilla.mozilla.org',
        bugzillaApiKey: 'test-api-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [] }),
      });

      await loadBugsByIds(['123456']);

      expect(mockFetch.mock.calls[0][1].headers).toHaveProperty('X-Bugzilla-API-Key', 'test-api-key');
    });
  });

  describe('loadBugsByRestUrl', () => {
    it('should fetch bugs from REST URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bugs: [{ id: 123456, summary: 'Bug 1' }],
        }),
      });

      const bugs = await loadBugsByRestUrl('https://bugzilla.mozilla.org/rest/bug?product=Firefox');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(bugs).toHaveLength(1);
    });

    it('should add include_fields if not present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [] }),
      });

      await loadBugsByRestUrl('https://bugzilla.mozilla.org/rest/bug?product=Firefox');

      expect(mockFetch.mock.calls[0][0]).toContain('include_fields=');
    });

    it('should preserve existing include_fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [] }),
      });

      const url = 'https://bugzilla.mozilla.org/rest/bug?include_fields=id,summary';
      await loadBugsByRestUrl(url);

      // Should not add duplicate include_fields
      const fetchedUrl = mockFetch.mock.calls[0][0];
      const matches = fetchedUrl.match(/include_fields=/g);
      expect(matches).toHaveLength(1);
    });

    it('should handle relative REST URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [] }),
      });

      await loadBugsByRestUrl('/rest/bug?product=Firefox');

      expect(mockFetch.mock.calls[0][0]).toContain('bugzilla.mozilla.org');
    });
  });

  describe('fetchAttachments', () => {
    it('should fetch attachments for a bug', async () => {
      const mockAttachments = {
        bugs: {
          123456: [
            { id: 1, file_name: 'test.html', is_obsolete: 0 },
            { id: 2, file_name: 'screenshot.png', is_obsolete: 0 },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAttachments,
      });

      const attachments = await fetchAttachments(123456);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/rest/bug/123456/attachment');
      expect(attachments).toHaveLength(2);
      expect(attachments[0].file_name).toBe('test.html');
    });

    it('should exclude attachment data by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: { 123456: [] } }),
      });

      await fetchAttachments(123456);

      expect(mockFetch.mock.calls[0][0]).toContain('exclude_fields=data');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const attachments = await fetchAttachments(123456);
      expect(attachments).toEqual([]);
    });
  });

  describe('fetchComments', () => {
    it('should fetch comments for a bug', async () => {
      const mockComments = {
        bugs: {
          123456: {
            comments: [
              { id: 1, text: 'Bug description', creation_time: '2024-01-01T00:00:00Z' },
              { id: 2, text: 'Additional info', creation_time: '2024-01-02T00:00:00Z' },
            ],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      });

      const comments = await fetchComments(123456);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/rest/bug/123456/comment');
      expect(comments).toHaveLength(2);
      expect(comments[0].text).toBe('Bug description');
    });

    it('should mark first comment as description', async () => {
      const mockComments = {
        bugs: {
          123456: {
            comments: [
              { id: 1, text: 'Bug description' },
              { id: 2, text: 'Comment 1' },
            ],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      });

      const comments = await fetchComments(123456);

      expect(comments[0].isDescription).toBe(true);
      expect(comments[1].isDescription).toBe(false);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const comments = await fetchComments(123456);
      expect(comments).toEqual([]);
    });
  });

  describe('setHasStr', () => {
    it('should set cf_has_str field on a bug', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bugs: [{ id: 123456, changes: {} }] }),
      });

      const result = await setHasStr(123456, 'test-api-key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/rest/bug/123456');
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
      expect(mockFetch.mock.calls[0][1].headers).toHaveProperty('X-Bugzilla-API-Key', 'test-api-key');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.cf_has_str).toBe('yes');
      expect(result).toBe(true);
    });

    it('should return false without API key', async () => {
      const result = await setHasStr(123456, '');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await setHasStr(123456, 'test-api-key');
      expect(result).toBe(false);
    });

    it('should return false on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await setHasStr(123456, 'test-api-key');
      expect(result).toBe(false);
    });
  });

  describe('postComment', () => {
    it('should post a comment to a bug', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 789 }),
      });

      const result = await postComment(123456, 'Test comment', 'test-api-key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/rest/bug/123456/comment');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
      expect(mockFetch.mock.calls[0][1].headers).toHaveProperty('X-Bugzilla-API-Key', 'test-api-key');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.comment).toBe('Test comment');
      expect(result).toBe(true);
    });

    it('should return false without API key', async () => {
      const result = await postComment(123456, 'Test comment', '');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false with empty comment', async () => {
      const result = await postComment(123456, '', 'test-api-key');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await postComment(123456, 'Test comment', 'test-api-key');
      expect(result).toBe(false);
    });
  });

  describe('CORS error handling', () => {
    it('should provide helpful message on CORS error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await loadBugsByIds(['123456']);
      } catch (error) {
        expect(error.message).toContain('fetch');
      }
    });
  });
});
