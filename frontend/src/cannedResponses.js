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

/** Storage key for localStorage persistence */
export const STORAGE_KEY = 'triage-wizard-canned-responses';

/** In-memory response library */
let responseLibrary = [];

/** Known metadata keys (case-insensitive) */
const METADATA_KEYS = ['id', 'title', 'categories', 'description'];

/**
 * Convert text to a URL-friendly slug.
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '');       // Trim leading/trailing hyphens
}

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
  if (!markdown) return [];

  const responses = [];
  const usedIds = new Set();

  // Split by level-2 headings, keeping the heading text
  const sections = markdown.split(/^## /m);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split('\n');

    // First line is the heading text
    const heading = lines[0].trim();
    if (!heading) continue;

    // Parse metadata and body
    const metadata = {};
    let bodyStartIndex = 1;

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      // Check for metadata line (Key: value)
      const metaMatch = line.match(/^([A-Za-z]+):\s*(.*)/);
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        if (METADATA_KEYS.includes(key)) {
          metadata[key] = metaMatch[2].trim();
        }
        // Both known and unknown metadata keys are consumed
        bodyStartIndex = j + 1;
      } else if (line.trim() === '') {
        // Empty line - continue looking (metadata might have gaps)
        bodyStartIndex = j + 1;
      } else {
        // Non-metadata, non-empty line - body starts here
        break;
      }
    }

    // Extract body (everything after metadata)
    const bodyLines = lines.slice(bodyStartIndex);
    const body = bodyLines.join('\n').trim();

    // Generate ID from explicit ID or heading
    let id = metadata.id || slugify(heading);

    // Handle duplicate IDs
    if (usedIds.has(id)) {
      let counter = 2;
      while (usedIds.has(`${id}-${counter}`)) {
        counter++;
      }
      id = `${id}-${counter}`;
    }
    usedIds.add(id);

    // Build response object
    const response = {
      id,
      title: metadata.title || heading,
      bodyTemplate: body,
    };

    // Add optional fields
    if (metadata.description) {
      response.description = metadata.description;
    }

    // Parse categories
    if (metadata.categories !== undefined) {
      if (metadata.categories.trim() === '') {
        response.categories = [];
      } else {
        response.categories = metadata.categories
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c);
      }
    } else {
      response.categories = [];
    }

    responses.push(response);
  }

  return responses;
}

/**
 * Load default responses from frontend/canned-responses.md.
 * @returns {Promise<CannedResponse[]>} Array of default responses
 */
export async function loadDefaults() {
  try {
    const response = await fetch('canned-responses.md');
    if (!response.ok) {
      console.log('[cannedResponses] No default canned-responses.md found');
      return [];
    }

    const markdown = await response.text();
    const parsed = parseCannedResponsesMarkdown(markdown);

    // Merge into library (don't replace, in case user has customized)
    for (const newResponse of parsed) {
      const existingIndex = responseLibrary.findIndex((r) => r.id === newResponse.id);
      if (existingIndex < 0) {
        responseLibrary.push(newResponse);
      }
    }

    persist();
    return parsed;
  } catch (err) {
    console.warn('[cannedResponses] Failed to load defaults:', err);
    return [];
  }
}

/**
 * Import responses from user-provided Markdown.
 * @param {string} markdown - Markdown text
 * @param {Object} options - Import options
 * @param {boolean} options.replace - Replace existing (true) or merge (false)
 * @returns {CannedResponse[]} Updated response library
 */
export function importMarkdown(markdown, options = { replace: false }) {
  const parsed = parseCannedResponsesMarkdown(markdown);

  if (options.replace) {
    responseLibrary = parsed;
  } else {
    // Merge: update existing by ID, add new ones
    for (const newResponse of parsed) {
      const existingIndex = responseLibrary.findIndex((r) => r.id === newResponse.id);
      if (existingIndex >= 0) {
        responseLibrary[existingIndex] = newResponse;
      } else {
        responseLibrary.push(newResponse);
      }
    }
  }

  persist();
  return responseLibrary;
}

/**
 * Persist the response library to localStorage.
 */
function persist() {
  storage.set(STORAGE_KEY, responseLibrary);
}

/**
 * Load responses from localStorage.
 */
export function loadFromStorage() {
  const stored = storage.get(STORAGE_KEY);
  if (stored && Array.isArray(stored)) {
    responseLibrary = stored;
  }
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
  if (!response || !response.id) {
    console.warn('[cannedResponses] Cannot save response without ID');
    return responseLibrary;
  }

  const existingIndex = responseLibrary.findIndex((r) => r.id === response.id);
  if (existingIndex >= 0) {
    responseLibrary[existingIndex] = { ...responseLibrary[existingIndex], ...response };
  } else {
    responseLibrary.push(response);
  }

  persist();
  return responseLibrary;
}

/**
 * Delete a response by ID.
 * @param {string} id - Response ID to delete
 * @returns {boolean} True if deleted
 */
export function deleteResponse(id) {
  const existingIndex = responseLibrary.findIndex((r) => r.id === id);
  if (existingIndex >= 0) {
    responseLibrary.splice(existingIndex, 1);
    persist();
    return true;
  }
  return false;
}

console.log('[cannedResponses] Module loaded');
