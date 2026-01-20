/**
 * @fileoverview localStorage wrapper module.
 *
 * Responsibilities:
 * - Get/set configuration values in localStorage
 * - Namespace keys with prefix to avoid collisions
 * - Handle localStorage exceptions (quota, unavailable)
 *
 * @module storage
 */

/** Key prefix for all localStorage keys */
export const KEY_PREFIX = 'btw_';

/**
 * Check if localStorage is available.
 * @returns {boolean} True if localStorage is available
 */
function isStorageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * Get a configuration value from localStorage.
 * @param {string} key - Configuration key (without prefix)
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} The stored value or defaultValue
 */
export function getConfig(key, defaultValue = null) {
  if (!isStorageAvailable()) {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(KEY_PREFIX + key);
    if (stored === null) {
      return defaultValue;
    }
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

/**
 * Set a configuration value in localStorage.
 * @param {string} key - Configuration key (without prefix)
 * @param {*} value - Value to store (will be JSON serialized)
 * @returns {boolean} True if successful, false otherwise
 */
export function setConfig(key, value) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all configuration values as an object.
 * @returns {Object} All stored configuration values
 */
export function getAllConfig() {
  if (!isStorageAvailable()) {
    return {};
  }

  const config = {};
  try {
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(KEY_PREFIX)) {
        const key = fullKey.slice(KEY_PREFIX.length);
        try {
          const stored = localStorage.getItem(fullKey);
          if (stored !== null) {
            config[key] = JSON.parse(stored);
          }
        } catch {
          // Skip keys with invalid JSON
        }
      }
    }
  } catch {
    // Return whatever we collected
  }
  return config;
}

/**
 * Remove a configuration value from localStorage.
 * @param {string} key - Configuration key (without prefix)
 * @returns {boolean} True if successful, false otherwise
 */
export function removeConfig(key) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(KEY_PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all configuration values (only keys with our prefix).
 * @returns {boolean} True if successful, false otherwise
 */
export function clearAllConfig() {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    // Collect keys first to avoid modifying during iteration
    const keysToRemove = [];
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(KEY_PREFIX)) {
        keysToRemove.push(fullKey);
      }
    }
    // Remove collected keys
    for (const fullKey of keysToRemove) {
      localStorage.removeItem(fullKey);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a value from localStorage (without prefix).
 * Use for data storage rather than configuration.
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} The stored value or defaultValue
 */
export function get(key, defaultValue = null) {
  if (!isStorageAvailable()) {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

/**
 * Set a value in localStorage (without prefix).
 * Use for data storage rather than configuration.
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON serialized)
 * @returns {boolean} True if successful, false otherwise
 */
export function set(key, value) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a value from localStorage (without prefix).
 * @param {string} key - Storage key
 * @returns {boolean} True if successful, false otherwise
 */
export function remove(key) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync configuration to server (future feature).
 * @param {Object} data - Data to sync
 * @param {string} authToken - Authentication token
 * @returns {Promise<void>}
 * @throws {Error} Not implemented
 */
export async function syncToServer(data, authToken) {
  // Future: Sync to backend server
  throw new Error('Not implemented');
}

console.log('[storage] Module loaded');
