/**
 * @fileoverview AI provider abstraction module.
 *
 * Responsibilities:
 * - Abstract AI providers (Gemini, Claude, OpenAI, Grok, Custom)
 * - Support browser mode (direct fetch) and backend mode (proxy)
 * - Provide tasks: classify, customize response, suggest response
 * - Return provider-agnostic JSON schemas
 *
 * Browser mode: Gemini, Claude only
 * Backend mode: All providers (via proxy at localhost:3000)
 *
 * @module ai
 */

import * as config from './config.js';

/**
 * Classification result schema.
 * @typedef {Object} ClassificationResult
 * @property {boolean} ai_detected_str - AI found clear reproduction steps
 * @property {boolean} ai_detected_test_attached - AI found testcase referenced
 * @property {boolean} crashstack_present - Crash/sanitizer stack detected
 * @property {boolean} fuzzing_testcase - Fuzzing-derived testcase detected
 * @property {string} summary - 1-3 sentence brief summary
 * @property {Object} [notes] - Optional additional notes
 */

/**
 * Classify a bug using AI.
 * @param {Object} bug - Bug object with description, comments, attachments
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<ClassificationResult>} Classification result
 */
export async function classifyBug(bug, providerConfig) {
  // TODO: Route to appropriate provider, return structured result
  console.log('[ai] Classifying bug:', bug?.id);
  return {
    ai_detected_str: false,
    ai_detected_test_attached: false,
    crashstack_present: false,
    fuzzing_testcase: false,
    summary: '',
    notes: {},
  };
}

/**
 * Customize a canned response for a specific bug.
 * @param {Object} bug - Bug object
 * @param {Object} cannedResponse - Selected canned response
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} { final_response, used_canned_id, notes }
 */
export async function customizeCannedResponse(bug, cannedResponse, providerConfig) {
  // TODO: Send bug context + template to AI, get customized response
  console.log('[ai] Customizing response for:', bug?.id);
  return {
    final_response: cannedResponse?.bodyTemplate || '',
    used_canned_id: cannedResponse?.id || '',
    notes: {},
  };
}

/**
 * Suggest the best canned response(s) for a bug.
 * @param {Object} bug - Bug object
 * @param {Object[]} cannedResponses - All available canned responses
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} { selected_responses[], fallback_custom_text }
 */
export async function suggestCannedResponse(bug, cannedResponses, providerConfig) {
  // TODO: Send bug context + response library to AI
  console.log('[ai] Suggesting response for:', bug?.id);
  return {
    selected_responses: [],
    fallback_custom_text: '',
  };
}

/**
 * Cluster bugs by similarity (future feature placeholder).
 * @param {Object[]} bugs - Bugs to cluster
 * @param {Object[]} comparisonBugs - Optional comparison bug set
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} Clustering result
 */
export async function clusterBugs(bugs, comparisonBugs = [], providerConfig) {
  // Future: AI-based similarity clustering
  throw new Error('Not implemented');
}

/**
 * Check if a provider supports browser mode.
 * @param {string} provider - Provider name
 * @returns {boolean} True if browser mode supported
 */
export function supportsBrowserMode(provider) {
  return ['gemini', 'claude'].includes(provider);
}

console.log('[ai] Module loaded');
