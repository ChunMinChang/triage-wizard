/**
 * @fileoverview Canned responses management module.
 *
 * Responsibilities:
 * - Parse canned responses from Markdown format
 * - Load default responses from canned-responses.md
 * - Import user .md files
 * - Store responses in localStorage
 *
 * @module cannedResponses
 */

import * as storage from './storage.js';

/**
 * Canned response object.
 * @typedef {Object} CannedResponse
 * @property {string} id - Unique identifier
 * @property {string} title - Display title
 * @property {string} bodyTemplate - Response body (Markdown)
 * @property {string} [description] - Triager-facing description
 * @property {string[]} [categories] - Category tags
 */

/** In-memory response library */
let responseLibrary = [];

/**
 * Parse canned responses from Markdown text.
 * Format per docs/canned-responses-spec.md:
 * - Level-2 headings (## ) start each response
 * - Metadata lines (Key: value) after heading
 * - Body is remaining content until next heading
 *
 * @param {string} markdown - Markdown text to parse
 * @returns {CannedResponse[]} Array of parsed responses
 */
export function parseCannedResponsesMarkdown(markdown) {
  // TODO: Parse ## headings, extract metadata and body
  console.log('[cannedResponses] Parsing markdown:', markdown?.length, 'chars');
  return [];
}

/**
 * Load default responses from frontend/canned-responses.md.
 * @returns {Promise<CannedResponse[]>} Array of default responses
 */
export async function loadDefaults() {
  // TODO: Fetch canned-responses.md, parse, return
  console.log('[cannedResponses] Loading defaults');
  return [];
}

/**
 * Import responses from user-provided Markdown.
 * @param {string} markdown - Markdown text
 * @param {Object} options - Import options
 * @param {boolean} options.replace - Replace existing (true) or merge (false)
 * @returns {CannedResponse[]} Updated response library
 */
export function importMarkdown(markdown, options = { replace: false }) {
  // TODO: Parse and merge/replace
  console.log('[cannedResponses] Importing markdown, replace:', options.replace);
  return responseLibrary;
}

/**
 * Get all responses in the library.
 * @returns {CannedResponse[]} All canned responses
 */
export function getAll() {
  return [...responseLibrary];
}

/**
 * Get a response by ID.
 * @param {string} id - Response ID
 * @returns {CannedResponse|null} Response or null if not found
 */
export function getById(id) {
  return responseLibrary.find(r => r.id === id) || null;
}

/**
 * Get responses by category.
 * @param {string} category - Category to filter by
 * @returns {CannedResponse[]} Matching responses
 */
export function getByCategory(category) {
  return responseLibrary.filter(r => r.categories?.includes(category));
}

/**
 * Save a response (add or update).
 * @param {CannedResponse} response - Response to save
 * @returns {CannedResponse[]} Updated library
 */
export function saveResponse(response) {
  // TODO: Add/update in library and persist
  console.log('[cannedResponses] Saving response:', response?.id);
  return responseLibrary;
}

/**
 * Delete a response by ID.
 * @param {string} id - Response ID to delete
 * @returns {boolean} True if deleted
 */
export function deleteResponse(id) {
  // TODO: Remove from library and persist
  console.log('[cannedResponses] Deleting response:', id);
  return false;
}

console.log('[cannedResponses] Module loaded');
