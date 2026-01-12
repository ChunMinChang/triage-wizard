/**
 * @fileoverview Configuration management module.
 *
 * Responsibilities:
 * - Manage Bugzilla host URL and API key
 * - Manage AI provider settings (provider, model, transport, API key)
 * - Provide defaults and validation
 * - Persist settings via storage module
 *
 * @module config
 */

import * as storage from './storage.js';

/** Default configuration values */
export const DEFAULTS = {
  bugzillaHost: 'https://bugzilla.mozilla.org',
  bugzillaApiKey: '',
  aiProvider: 'gemini', // gemini | claude | openai | grok | custom
  aiModel: '',
  aiTransport: 'browser', // browser | backend
  aiApiKey: '',
  backendUrl: 'http://localhost:3000',
};

/** Valid AI provider options */
export const AI_PROVIDERS = ['gemini', 'claude', 'openai', 'grok', 'custom'];

/** Valid transport options */
export const TRANSPORTS = ['browser', 'backend'];

/**
 * Get the current configuration.
 * @returns {Object} Current configuration merged with defaults
 */
export function getConfig() {
  // TODO: Load from storage and merge with defaults
  return { ...DEFAULTS };
}

/**
 * Update configuration with new values.
 * @param {Object} changes - Object with keys to update
 * @returns {Object} Updated configuration
 */
export function updateConfig(changes) {
  // TODO: Validate and save changes
  return { ...DEFAULTS, ...changes };
}

/**
 * Reset configuration to defaults.
 * @returns {Object} Default configuration
 */
export function resetToDefaults() {
  // TODO: Clear storage and return defaults
  return { ...DEFAULTS };
}

/**
 * Validate a URL string.
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

console.log('[config] Module loaded');
