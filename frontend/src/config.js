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

/** Storage key for configuration */
export const CONFIG_KEY = 'config';

/** Default configuration values */
export const DEFAULTS = {
  bugzillaHost: 'https://bugzilla.mozilla.org',
  bugzillaApiKey: '',
  aiProvider: 'none', // none | gemini | claude | openai | grok | custom
  aiModel: '',
  aiTransport: 'browser', // browser | backend
  aiApiKey: '',
  backendUrl: 'http://localhost:3000',
};

/** Valid AI provider options */
export const AI_PROVIDERS = ['none', 'gemini', 'claude', 'openai', 'grok', 'custom'];

/** Valid transport options */
export const TRANSPORTS = ['browser', 'backend'];

/** Config fields that are allowed to be stored */
const ALLOWED_FIELDS = Object.keys(DEFAULTS);

/**
 * Validate a URL string (http/https only).
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid HTTP/HTTPS URL
 */
export function isValidUrl(url) {
  if (url === null || url === undefined || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate an AI provider string.
 * @param {string} provider - Provider to validate
 * @returns {boolean} True if valid provider
 */
export function isValidProvider(provider) {
  return typeof provider === 'string' && AI_PROVIDERS.includes(provider);
}

/**
 * Validate a transport string.
 * @param {string} transport - Transport to validate
 * @returns {boolean} True if valid transport
 */
export function isValidTransport(transport) {
  return typeof transport === 'string' && TRANSPORTS.includes(transport);
}

/**
 * Validate a complete configuration object.
 * @param {Object} config - Configuration to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateConfig(config) {
  const errors = [];

  if (!isValidUrl(config.bugzillaHost)) {
    errors.push('Invalid Bugzilla host URL');
  }

  if (!isValidUrl(config.backendUrl)) {
    errors.push('Invalid backend URL');
  }

  if (!isValidProvider(config.aiProvider)) {
    errors.push('Invalid AI provider');
  }

  if (!isValidTransport(config.aiTransport)) {
    errors.push('Invalid AI transport');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the current configuration.
 * @returns {Object} Current configuration merged with defaults
 */
export function getConfig() {
  const stored = storage.getConfig(CONFIG_KEY, null);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULTS };
  }

  // Merge stored values with defaults, only keeping allowed fields
  const merged = { ...DEFAULTS };
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(stored, key)) {
      merged[key] = stored[key];
    }
  }
  return merged;
}

/**
 * Update configuration with new values.
 * @param {Object} changes - Object with keys to update
 * @returns {{valid: boolean, errors: string[], config: Object}} Update result
 */
export function updateConfig(changes) {
  // Get current config
  const current = getConfig();

  // Filter changes to only allowed fields
  const filteredChanges = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      filteredChanges[key] = changes[key];
    }
  }

  // Merge with current config
  const newConfig = { ...current, ...filteredChanges };

  // Validate the new config
  const validation = validateConfig(newConfig);

  if (validation.valid) {
    // Persist to storage
    storage.setConfig(CONFIG_KEY, newConfig);
  }

  return {
    valid: validation.valid,
    errors: validation.errors,
    config: newConfig,
  };
}

/**
 * Reset configuration to defaults.
 * @returns {Object} Default configuration
 */
export function resetToDefaults() {
  storage.removeConfig(CONFIG_KEY);
  return { ...DEFAULTS };
}

console.log('[config] Module loaded');
