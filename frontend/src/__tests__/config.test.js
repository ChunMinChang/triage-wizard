/**
 * @fileoverview Tests for config module (settings management)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as storage from '../storage.js';
import {
  getConfig,
  updateConfig,
  resetToDefaults,
  isValidUrl,
  isValidProvider,
  isValidTransport,
  validateConfig,
  hasUserConfig,
  detectBackend,
  initializeWithBackendDetection,
  DEFAULTS,
  BACKEND_DEFAULTS,
  AI_PROVIDERS,
  TRANSPORTS,
  CONFIG_KEY,
} from '../config.js';

// Mock the storage module
vi.mock('../storage.js', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  removeConfig: vi.fn(),
}));

describe('config module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getConfig.mockReturnValue(null);
    storage.setConfig.mockReturnValue(true);
  });

  describe('constants', () => {
    it('should export CONFIG_KEY', () => {
      expect(CONFIG_KEY).toBe('config');
    });

    it('should export DEFAULTS with required fields', () => {
      expect(DEFAULTS).toHaveProperty('bugzillaHost');
      expect(DEFAULTS).toHaveProperty('bugzillaApiKey');
      expect(DEFAULTS).toHaveProperty('aiProvider');
      expect(DEFAULTS).toHaveProperty('aiModel');
      expect(DEFAULTS).toHaveProperty('aiTransport');
      expect(DEFAULTS).toHaveProperty('aiApiKey');
      expect(DEFAULTS).toHaveProperty('backendUrl');
    });

    it('should have correct default values', () => {
      expect(DEFAULTS.bugzillaHost).toBe('https://bugzilla.mozilla.org');
      expect(DEFAULTS.bugzillaApiKey).toBe('');
      expect(DEFAULTS.aiProvider).toBe('none');
      expect(DEFAULTS.aiModel).toBe('');
      expect(DEFAULTS.aiTransport).toBe('browser');
      expect(DEFAULTS.aiApiKey).toBe('');
      expect(DEFAULTS.backendUrl).toBe('');
    });

    it('should export AI_PROVIDERS array', () => {
      expect(AI_PROVIDERS).toContain('none');
      expect(AI_PROVIDERS).toContain('gemini');
      expect(AI_PROVIDERS).toContain('claude');
      expect(AI_PROVIDERS).toContain('openai');
      expect(AI_PROVIDERS).toContain('grok');
      expect(AI_PROVIDERS).toContain('custom');
    });

    it('should export TRANSPORTS array', () => {
      expect(TRANSPORTS).toContain('browser');
      expect(TRANSPORTS).toContain('backend');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('http://192.168.1.1:8080')).toBe(true);
    });

    it('should return true for valid HTTPS URLs', () => {
      expect(isValidUrl('https://bugzilla.mozilla.org')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://api.example.com:443/v1')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('://missing-scheme')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false); // Only http/https
    });

    it('should return false for null/undefined', () => {
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });
  });

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('none')).toBe(true);
      expect(isValidProvider('gemini')).toBe(true);
      expect(isValidProvider('claude')).toBe(true);
      expect(isValidProvider('openai')).toBe(true);
      expect(isValidProvider('grok')).toBe(true);
      expect(isValidProvider('custom')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidProvider('invalid')).toBe(false);
      expect(isValidProvider('')).toBe(false);
      expect(isValidProvider(null)).toBe(false);
      expect(isValidProvider(undefined)).toBe(false);
    });
  });

  describe('isValidTransport', () => {
    it('should return true for valid transports', () => {
      expect(isValidTransport('browser')).toBe(true);
      expect(isValidTransport('backend')).toBe(true);
    });

    it('should return false for invalid transports', () => {
      expect(isValidTransport('invalid')).toBe(false);
      expect(isValidTransport('')).toBe(false);
      expect(isValidTransport(null)).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should return success for valid config', () => {
      const config = {
        ...DEFAULTS,
        bugzillaHost: 'https://bugzilla.mozilla.org',
        backendUrl: 'http://localhost:3000',
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for invalid bugzillaHost', () => {
      const config = { ...DEFAULTS, bugzillaHost: 'invalid-url' };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid Bugzilla host URL');
    });

    it('should return error for invalid backendUrl', () => {
      const config = { ...DEFAULTS, backendUrl: 'invalid-url' };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid backend URL');
    });

    it('should return error for invalid aiProvider', () => {
      const config = { ...DEFAULTS, aiProvider: 'invalid' };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid AI provider');
    });

    it('should return error for invalid aiTransport', () => {
      const config = { ...DEFAULTS, aiTransport: 'invalid' };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid AI transport');
    });

    it('should collect multiple errors', () => {
      const config = {
        ...DEFAULTS,
        bugzillaHost: 'bad',
        backendUrl: 'bad',
        aiProvider: 'bad',
        aiTransport: 'bad',
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getConfig', () => {
    it('should return defaults when no stored config', () => {
      storage.getConfig.mockReturnValue(null);
      const config = getConfig();
      expect(config).toEqual(DEFAULTS);
    });

    it('should merge stored config with defaults', () => {
      storage.getConfig.mockReturnValue({
        bugzillaApiKey: 'my-api-key',
        aiProvider: 'claude',
      });
      const config = getConfig();
      expect(config.bugzillaApiKey).toBe('my-api-key');
      expect(config.aiProvider).toBe('claude');
      expect(config.bugzillaHost).toBe(DEFAULTS.bugzillaHost);
    });

    it('should read from storage with correct key', () => {
      getConfig();
      expect(storage.getConfig).toHaveBeenCalledWith(CONFIG_KEY, null);
    });

    it('should handle corrupted stored config gracefully', () => {
      storage.getConfig.mockReturnValue({ bugzillaHost: 123 }); // wrong type
      const config = getConfig();
      // Should still return a valid config merged with defaults
      expect(config.bugzillaHost).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update single field', () => {
      const result = updateConfig({ bugzillaApiKey: 'new-key' });
      expect(result.config.bugzillaApiKey).toBe('new-key');
      expect(result.valid).toBe(true);
    });

    it('should update multiple fields', () => {
      const result = updateConfig({
        bugzillaApiKey: 'key',
        aiProvider: 'gemini',
        aiApiKey: 'gemini-key',
      });
      expect(result.config.bugzillaApiKey).toBe('key');
      expect(result.config.aiProvider).toBe('gemini');
      expect(result.config.aiApiKey).toBe('gemini-key');
    });

    it('should persist to storage on valid update', () => {
      updateConfig({ bugzillaApiKey: 'new-key' });
      expect(storage.setConfig).toHaveBeenCalledWith(
        CONFIG_KEY,
        expect.objectContaining({ bugzillaApiKey: 'new-key' })
      );
    });

    it('should not persist invalid config', () => {
      const result = updateConfig({ bugzillaHost: 'invalid-url' });
      expect(result.valid).toBe(false);
      expect(storage.setConfig).not.toHaveBeenCalled();
    });

    it('should return validation errors for invalid values', () => {
      const result = updateConfig({ aiProvider: 'invalid-provider' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid AI provider');
    });

    it('should preserve existing stored values when updating', () => {
      storage.getConfig.mockReturnValue({
        bugzillaApiKey: 'existing-key',
        aiProvider: 'gemini',
      });

      updateConfig({ aiModel: 'gemini-pro' });

      expect(storage.setConfig).toHaveBeenCalledWith(
        CONFIG_KEY,
        expect.objectContaining({
          bugzillaApiKey: 'existing-key',
          aiProvider: 'gemini',
          aiModel: 'gemini-pro',
        })
      );
    });

    it('should ignore unknown fields', () => {
      const result = updateConfig({ unknownField: 'value' });
      expect(result.config).not.toHaveProperty('unknownField');
    });
  });

  describe('resetToDefaults', () => {
    it('should return default config', () => {
      const config = resetToDefaults();
      expect(config).toEqual(DEFAULTS);
    });

    it('should clear stored config', () => {
      resetToDefaults();
      expect(storage.removeConfig).toHaveBeenCalledWith(CONFIG_KEY);
    });

    it('should return defaults even if storage fails', () => {
      storage.removeConfig.mockReturnValue(false);
      const config = resetToDefaults();
      expect(config).toEqual(DEFAULTS);
    });
  });

  describe('integration scenarios', () => {
    it('should support full config workflow', () => {
      // 1. Start with defaults
      storage.getConfig.mockReturnValue(null);
      let config = getConfig();
      expect(config.aiProvider).toBe('none');

      // 2. User configures AI
      storage.getConfig.mockReturnValue({ aiProvider: 'gemini' });
      const updateResult = updateConfig({
        aiProvider: 'gemini',
        aiApiKey: 'test-key',
      });
      expect(updateResult.valid).toBe(true);

      // 3. Simulate page reload - config persists
      storage.getConfig.mockReturnValue({
        aiProvider: 'gemini',
        aiApiKey: 'test-key',
      });
      config = getConfig();
      expect(config.aiProvider).toBe('gemini');
      expect(config.aiApiKey).toBe('test-key');

      // 4. Reset to defaults
      resetToDefaults();
      expect(storage.removeConfig).toHaveBeenCalled();
    });

    it('should handle backend-only providers correctly', () => {
      // OpenAI requires backend transport
      const result = updateConfig({
        aiProvider: 'openai',
        aiTransport: 'backend',
        aiApiKey: 'openai-key',
      });
      expect(result.valid).toBe(true);
      expect(result.config.aiTransport).toBe('backend');
    });
  });

  describe('backend detection', () => {
    beforeEach(() => {
      // Reset fetch mock
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should export BACKEND_DEFAULTS with Claude and backend transport', () => {
      expect(BACKEND_DEFAULTS).toBeDefined();
      expect(BACKEND_DEFAULTS.aiProvider).toBe('claude');
      expect(BACKEND_DEFAULTS.aiTransport).toBe('backend');
      expect(BACKEND_DEFAULTS.backendUrl).toBe('');
    });

    it('should detect backend when /health returns ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          availableProviders: ['claude'],
          recommendedProvider: 'claude',
        }),
      });

      const result = await detectBackend();
      expect(result.available).toBe(true);
      expect(result.providers).toEqual(['claude']);
      expect(result.recommendedProvider).toBe('claude');
      expect(global.fetch).toHaveBeenCalledWith('/health', expect.any(Object));
    });

    it('should return available providers from health check', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          availableProviders: ['claude', 'gemini'],
          recommendedProvider: 'claude',
        }),
      });

      const result = await detectBackend();
      expect(result.available).toBe(true);
      expect(result.providers).toEqual(['claude', 'gemini']);
      expect(result.recommendedProvider).toBe('claude');
    });

    it('should return false when /health fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await detectBackend();
      expect(result.available).toBe(false);
      expect(result.providers).toEqual([]);
      expect(result.recommendedProvider).toBeNull();
    });

    it('should return false when fetch throws', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await detectBackend();
      expect(result.available).toBe(false);
      expect(result.providers).toEqual([]);
      expect(result.recommendedProvider).toBeNull();
    });

    it('should apply backend defaults when backend detected and no user config', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          availableProviders: ['claude'],
          recommendedProvider: 'claude',
        }),
      });
      storage.getConfig.mockReturnValue(null); // No user config

      const result = await initializeWithBackendDetection();

      expect(result.backendDetected).toBe(true);
      expect(result.defaultsApplied).toBe(true);
      expect(result.availableProviders).toEqual(['claude']);
      expect(result.recommendedProvider).toBe('claude');
      expect(storage.setConfig).toHaveBeenCalledWith(
        CONFIG_KEY,
        expect.objectContaining({
          aiProvider: 'claude',
          aiTransport: 'backend',
        })
      );
    });

    it('should use recommended provider from backend', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          availableProviders: ['gemini', 'claude'],
          recommendedProvider: 'gemini',
        }),
      });
      storage.getConfig.mockReturnValue(null); // No user config

      const result = await initializeWithBackendDetection();

      expect(result.backendDetected).toBe(true);
      expect(result.defaultsApplied).toBe(true);
      expect(storage.setConfig).toHaveBeenCalledWith(
        CONFIG_KEY,
        expect.objectContaining({
          aiProvider: 'gemini',
          aiTransport: 'backend',
        })
      );
    });

    it('should NOT apply backend defaults when user has existing config', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          availableProviders: ['claude'],
          recommendedProvider: 'claude',
        }),
      });
      storage.getConfig.mockReturnValue({ aiProvider: 'gemini' }); // User has config

      const result = await initializeWithBackendDetection();

      expect(result.backendDetected).toBe(true);
      expect(result.defaultsApplied).toBe(false);
      expect(result.availableProviders).toEqual(['claude']);
      // setConfig should not be called to overwrite user config
    });

    it('should NOT apply backend defaults when no backend detected', async () => {
      global.fetch.mockRejectedValueOnce(new Error('No backend'));
      storage.getConfig.mockReturnValue(null);

      const result = await initializeWithBackendDetection();

      expect(result.backendDetected).toBe(false);
      expect(result.defaultsApplied).toBe(false);
      expect(result.availableProviders).toEqual([]);
      expect(result.recommendedProvider).toBeNull();
    });

    it('hasUserConfig should return true when config exists', () => {
      storage.getConfig.mockReturnValue({ aiProvider: 'gemini' });
      expect(hasUserConfig()).toBe(true);
    });

    it('hasUserConfig should return false when no config', () => {
      storage.getConfig.mockReturnValue(null);
      expect(hasUserConfig()).toBe(false);
    });
  });
});
