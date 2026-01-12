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
 * Load bugs by their IDs.
 * @param {string[]} ids - Array of bug IDs
 * @returns {Promise<Object[]>} Array of bug objects
 */
export async function loadBugsByIds(ids) {
  // TODO: Fetch via /rest/bug?id=1,2,3&include_fields=...
  console.log('[bugzilla] Loading bugs by IDs:', ids);
  return [];
}

/**
 * Load bugs from a REST URL.
 * @param {string} url - Bugzilla REST URL
 * @returns {Promise<Object[]>} Array of bug objects
 */
export async function loadBugsByRestUrl(url) {
  // TODO: Fetch from REST URL
  console.log('[bugzilla] Loading bugs by REST URL:', url);
  return [];
}

/**
 * Parse a buglist.cgi URL and convert to REST query.
 * @param {string} url - buglist.cgi URL
 * @returns {string|null} REST URL or null if cannot parse
 */
export function parseBuglistUrl(url) {
  // TODO: Parse buglist.cgi parameters and map to REST
  console.log('[bugzilla] Parsing buglist URL:', url);
  return null;
}

/**
 * Fetch attachments for a bug.
 * @param {string|number} bugId - Bug ID
 * @returns {Promise<Object[]>} Array of attachment objects
 */
export async function fetchAttachments(bugId) {
  // TODO: Fetch via /rest/bug/{id}/attachment
  console.log('[bugzilla] Fetching attachments for:', bugId);
  return [];
}

/**
 * Fetch comments for a bug.
 * @param {string|number} bugId - Bug ID
 * @returns {Promise<Object[]>} Array of comment objects (comment 0 = description)
 */
export async function fetchComments(bugId) {
  // TODO: Fetch via /rest/bug/{id}/comment
  console.log('[bugzilla] Fetching comments for:', bugId);
  return [];
}

/**
 * Set the Has STR field on a bug.
 * @param {string|number} bugId - Bug ID
 * @param {string} apiKey - Bugzilla API key
 * @returns {Promise<boolean>} True if successful
 */
export async function setHasStr(bugId, apiKey) {
  // TODO: PUT /rest/bug/{id} with { cf_has_str: 'yes' }
  console.log('[bugzilla] Setting Has STR for:', bugId);
  return false;
}

/**
 * Post a comment to a bug.
 * @param {string|number} bugId - Bug ID
 * @param {string} comment - Comment text
 * @param {string} apiKey - Bugzilla API key
 * @returns {Promise<boolean>} True if successful
 */
export async function postComment(bugId, comment, apiKey) {
  // TODO: POST /rest/bug/{id}/comment with { comment }
  console.log('[bugzilla] Posting comment to:', bugId);
  return false;
}

console.log('[bugzilla] Module loaded');
