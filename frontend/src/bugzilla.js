/**
 * @fileoverview Bugzilla REST API integration module.
 *
 * Responsibilities:
 * - Fetch bugs by IDs via REST API
 * - Fetch bugs by REST URL
 * - Parse buglist.cgi URLs and convert to REST queries
 * - Fetch attachments and comments
 * - Handle Bugzilla write operations (set Has STR, post comment)
 *
 * @module bugzilla
 */

import * as config from './config.js';

/**
 * Fields to include when fetching bugs.
 * These cover all fields needed for tag computation and display.
 */
export const BUG_FIELDS = [
  'id',
  'summary',
  'status',
  'resolution',
  'product',
  'component',
  'severity',
  'priority',
  'keywords',
  'cf_has_str',
  'cf_crash_signature',
  'flags',
  'creator',
  'assigned_to',
  'creation_time',
  'last_change_time',
];

/**
 * Parse user input string to determine type and extract data.
 * @param {string} input - User input (bug IDs, REST URL, or buglist URL)
 * @returns {{type: 'ids'|'rest'|'buglist', ids?: string[], url?: string}}
 */
export function parseInputString(input) {
  const trimmed = (input || '').trim();

  if (!trimmed) {
    return { type: 'ids', ids: [] };
  }

  // Check for REST URL
  if (trimmed.includes('/rest/bug')) {
    return { type: 'rest', url: trimmed };
  }

  // Check for buglist.cgi URL
  if (trimmed.includes('buglist.cgi')) {
    return { type: 'buglist', url: trimmed };
  }

  // Check if it looks like a URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Unknown URL type, try to detect
    if (trimmed.includes('buglist.cgi')) {
      return { type: 'buglist', url: trimmed };
    }
    return { type: 'rest', url: trimmed };
  }

  // Parse as bug IDs (space, comma, or newline separated)
  const ids = trimmed
    .split(/[\s,\n]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));

  return { type: 'ids', ids };
}

/**
 * Parse a buglist.cgi URL and convert to REST query.
 * @param {string} url - buglist.cgi URL
 * @returns {string|null} REST URL or null if cannot parse
 */
export function parseBuglistUrl(url) {
  if (!url) return null;

  try {
    // Handle relative URLs
    let fullUrl;
    if (url.startsWith('/')) {
      const cfg = config.getConfig();
      fullUrl = new URL(url, cfg.bugzillaHost);
    } else if (!url.startsWith('http')) {
      return null;
    } else {
      fullUrl = new URL(url);
    }

    // Must be a buglist.cgi URL
    if (!fullUrl.pathname.includes('buglist.cgi')) {
      return null;
    }

    // Build REST URL from query parameters
    const params = new URLSearchParams(fullUrl.search);
    const restParams = new URLSearchParams();

    // Map buglist.cgi parameters to REST API parameters
    for (const [key, value] of params.entries()) {
      switch (key) {
        case 'bug_id':
          // bug_id in buglist becomes id in REST
          restParams.append('id', value);
          break;
        case 'query_format':
        case 'list_id':
        case 'ctype':
        case 'human':
          // Skip buglist-specific parameters
          break;
        default:
          // Pass through other parameters (product, component, status, etc.)
          restParams.append(key, value);
      }
    }

    // Add include_fields
    restParams.set('include_fields', BUG_FIELDS.join(','));

    // Build REST URL
    const restUrl = new URL('/rest/bug', fullUrl.origin);
    restUrl.search = restParams.toString();

    return restUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Normalize a raw Bugzilla bug object to our internal format.
 * @param {Object} rawBug - Raw bug object from Bugzilla API
 * @returns {Object} Normalized bug object
 */
export function normalizeBug(rawBug) {
  // Handle keywords - can be array or string
  let keywords = rawBug.keywords || [];
  if (typeof keywords === 'string') {
    keywords = keywords ? [keywords] : [];
  }

  return {
    id: rawBug.id,
    summary: rawBug.summary || '',
    status: rawBug.status || '',
    resolution: rawBug.resolution || '',
    product: rawBug.product || '',
    component: rawBug.component || '',
    severity: rawBug.severity || '',
    priority: rawBug.priority || '',
    keywords,
    cfHasStr: rawBug.cf_has_str || '',
    cfCrashSignature: rawBug.cf_crash_signature || '',
    flags: rawBug.flags || [],
    creator: rawBug.creator || '',
    assignedTo: rawBug.assigned_to || '',
    creationTime: rawBug.creation_time || '',
    lastChangeTime: rawBug.last_change_time || '',
    // Placeholders for computed data
    attachments: [],
    comments: [],
    tags: [],
    aiSummary: '',
  };
}

/**
 * Build fetch options with optional API key.
 * @param {string} [method='GET'] - HTTP method
 * @param {Object} [body] - Request body (will be JSON stringified)
 * @param {string} [apiKey] - Bugzilla API key
 * @returns {RequestInit} Fetch options
 */
function buildFetchOptions(method = 'GET', body = null, apiKey = '') {
  const options = {
    method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (apiKey) {
    options.headers['X-Bugzilla-API-Key'] = apiKey;
  }

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  return options;
}

/**
 * Build full URL with host from config.
 * @param {string} path - URL path or full URL
 * @returns {string} Full URL
 */
function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cfg = config.getConfig();
  return new URL(path, cfg.bugzillaHost).toString();
}

/**
 * Ensure URL has include_fields parameter.
 * @param {string} url - URL to check
 * @returns {string} URL with include_fields
 */
function ensureIncludeFields(url) {
  const parsed = new URL(url);
  if (!parsed.searchParams.has('include_fields')) {
    parsed.searchParams.set('include_fields', BUG_FIELDS.join(','));
  }
  return parsed.toString();
}

/**
 * Load bugs by their IDs.
 * @param {string[]} ids - Array of bug IDs
 * @returns {Promise<Object[]>} Array of normalized bug objects
 */
export async function loadBugsByIds(ids) {
  if (!ids || ids.length === 0) {
    return [];
  }

  const cfg = config.getConfig();
  const url = new URL('/rest/bug', cfg.bugzillaHost);
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('include_fields', BUG_FIELDS.join(','));

  const options = buildFetchOptions('GET', null, cfg.bugzillaApiKey);
  const response = await fetch(url.toString(), options);

  if (!response.ok) {
    throw new Error(`Bugzilla API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.bugs || []).map(normalizeBug);
}

/**
 * Load bugs from a REST URL.
 * @param {string} url - Bugzilla REST URL
 * @returns {Promise<Object[]>} Array of normalized bug objects
 */
export async function loadBugsByRestUrl(url) {
  const cfg = config.getConfig();
  let fullUrl = buildUrl(url);
  fullUrl = ensureIncludeFields(fullUrl);

  const options = buildFetchOptions('GET', null, cfg.bugzillaApiKey);
  const response = await fetch(fullUrl, options);

  if (!response.ok) {
    throw new Error(`Bugzilla API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.bugs || []).map(normalizeBug);
}

/**
 * Fetch attachments for a bug.
 * @param {string|number} bugId - Bug ID
 * @returns {Promise<Object[]>} Array of attachment objects
 */
export async function fetchAttachments(bugId) {
  try {
    const cfg = config.getConfig();
    const url = new URL(`/rest/bug/${bugId}/attachment`, cfg.bugzillaHost);
    // Exclude attachment data (binary content) to reduce payload
    url.searchParams.set('exclude_fields', 'data');

    const options = buildFetchOptions('GET', null, cfg.bugzillaApiKey);
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      console.warn(`Failed to fetch attachments for bug ${bugId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Attachments are returned under bugs.{bugId}
    return data.bugs?.[bugId] || [];
  } catch (error) {
    console.warn(`Error fetching attachments for bug ${bugId}:`, error);
    return [];
  }
}

/**
 * Fetch comments for a bug.
 * @param {string|number} bugId - Bug ID
 * @returns {Promise<Object[]>} Array of comment objects (first comment marked as description)
 */
export async function fetchComments(bugId) {
  try {
    const cfg = config.getConfig();
    const url = new URL(`/rest/bug/${bugId}/comment`, cfg.bugzillaHost);

    const options = buildFetchOptions('GET', null, cfg.bugzillaApiKey);
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      console.warn(`Failed to fetch comments for bug ${bugId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Comments are returned under bugs.{bugId}.comments
    const comments = data.bugs?.[bugId]?.comments || [];

    // Mark first comment as description (comment 0 in Bugzilla terminology)
    return comments.map((comment, index) => ({
      ...comment,
      isDescription: index === 0,
    }));
  } catch (error) {
    console.warn(`Error fetching comments for bug ${bugId}:`, error);
    return [];
  }
}

/**
 * Set the Has STR field on a bug.
 * @param {string|number} bugId - Bug ID
 * @param {string} apiKey - Bugzilla API key
 * @returns {Promise<boolean>} True if successful
 */
export async function setHasStr(bugId, apiKey) {
  if (!apiKey) {
    console.warn('Cannot set Has STR: no API key provided');
    return false;
  }

  try {
    const cfg = config.getConfig();
    const url = new URL(`/rest/bug/${bugId}`, cfg.bugzillaHost);

    const options = buildFetchOptions('PUT', { cf_has_str: 'yes' }, apiKey);
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      console.warn(`Failed to set Has STR for bug ${bugId}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Error setting Has STR for bug ${bugId}:`, error);
    return false;
  }
}

/**
 * Post a comment to a bug.
 * @param {string|number} bugId - Bug ID
 * @param {string} comment - Comment text
 * @param {string} apiKey - Bugzilla API key
 * @returns {Promise<boolean>} True if successful
 */
export async function postComment(bugId, comment, apiKey) {
  if (!apiKey) {
    console.warn('Cannot post comment: no API key provided');
    return false;
  }

  if (!comment || !comment.trim()) {
    console.warn('Cannot post empty comment');
    return false;
  }

  try {
    const cfg = config.getConfig();
    const url = new URL(`/rest/bug/${bugId}/comment`, cfg.bugzillaHost);

    const options = buildFetchOptions('POST', { comment: comment.trim() }, apiKey);
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      console.warn(`Failed to post comment to bug ${bugId}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Error posting comment to bug ${bugId}:`, error);
    return false;
  }
}

/**
 * Load comparison bugs for clustering (future feature).
 * @param {string} query - Bugzilla query string
 * @returns {Promise<Object[]>} Array of bug objects
 */
export async function loadComparisonBugs(query) {
  // Future: Load bugs matching query for comparison/clustering
  throw new Error('Not implemented');
}

console.log('[bugzilla] Module loaded');
