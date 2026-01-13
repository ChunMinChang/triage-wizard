/**
 * @fileoverview Tests for AI provider abstraction module (L3-F1)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch for browser API calls
global.fetch = vi.fn();

// Import after setting up globals
import {
  classifyBug,
  customizeCannedResponse,
  suggestCannedResponse,
  generateResponse,
  refineResponse,
  supportsBrowserMode,
  isProviderConfigured,
  validateClassificationResult,
  validateCustomizeResult,
  validateSuggestResult,
  validateGenerateResult,
  validateRefineResult,
  buildClassificationPrompt,
  buildCustomizePrompt,
  buildSuggestPrompt,
  buildGeneratePrompt,
  buildRefinePrompt,
  PROVIDERS,
  DEFAULT_MODELS,
  TRANSPORT_MODES,
} from '../ai.js';

describe('ai module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constants', () => {
    it('should export PROVIDERS object', () => {
      expect(PROVIDERS).toBeDefined();
      expect(PROVIDERS.GEMINI).toBe('gemini');
      expect(PROVIDERS.CLAUDE).toBe('claude');
      expect(PROVIDERS.OPENAI).toBe('openai');
      expect(PROVIDERS.GROK).toBe('grok');
      expect(PROVIDERS.CUSTOM).toBe('custom');
      expect(PROVIDERS.NONE).toBe('none');
    });

    it('should export DEFAULT_MODELS object', () => {
      expect(DEFAULT_MODELS).toBeDefined();
      expect(DEFAULT_MODELS.gemini).toBeDefined();
      expect(DEFAULT_MODELS.claude).toBeDefined();
    });

    it('should export TRANSPORT_MODES object', () => {
      expect(TRANSPORT_MODES).toBeDefined();
      expect(TRANSPORT_MODES.BROWSER).toBe('browser');
      expect(TRANSPORT_MODES.BACKEND).toBe('backend');
    });
  });

  describe('supportsBrowserMode', () => {
    it('should return true for gemini', () => {
      expect(supportsBrowserMode('gemini')).toBe(true);
    });

    it('should return true for claude', () => {
      expect(supportsBrowserMode('claude')).toBe(true);
    });

    it('should return false for openai', () => {
      expect(supportsBrowserMode('openai')).toBe(false);
    });

    it('should return false for grok', () => {
      expect(supportsBrowserMode('grok')).toBe(false);
    });

    it('should return false for none', () => {
      expect(supportsBrowserMode('none')).toBe(false);
    });

    it('should return false for unknown provider', () => {
      expect(supportsBrowserMode('unknown')).toBe(false);
    });
  });

  describe('isProviderConfigured', () => {
    it('should return false when provider is none', () => {
      expect(isProviderConfigured({ provider: 'none' })).toBe(false);
    });

    it('should return false when no config provided', () => {
      expect(isProviderConfigured(null)).toBe(false);
      expect(isProviderConfigured(undefined)).toBe(false);
    });

    it('should return false when apiKey missing in browser mode', () => {
      expect(
        isProviderConfigured({
          provider: 'gemini',
          transport: 'browser',
          apiKey: '',
        })
      ).toBe(false);
    });

    it('should return true when apiKey provided in browser mode', () => {
      expect(
        isProviderConfigured({
          provider: 'gemini',
          transport: 'browser',
          apiKey: 'test-key',
        })
      ).toBe(true);
    });

    it('should return true in backend mode even without apiKey', () => {
      expect(
        isProviderConfigured({
          provider: 'claude',
          transport: 'backend',
        })
      ).toBe(true);
    });

    it('should return true for custom provider with baseUrl', () => {
      expect(
        isProviderConfigured({
          provider: 'custom',
          transport: 'browser',
          baseUrl: 'https://my-api.example.com',
          apiKey: 'test-key',
        })
      ).toBe(true);
    });
  });

  describe('validateClassificationResult', () => {
    it('should return valid for correct schema', () => {
      const result = {
        ai_detected_str: true,
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: true,
        summary: 'Test summary',
      };
      const validation = validateClassificationResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return invalid when missing required fields', () => {
      const result = {
        ai_detected_str: true,
        summary: 'Test',
      };
      const validation = validateClassificationResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should return invalid for wrong types', () => {
      const result = {
        ai_detected_str: 'yes', // should be boolean
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: false,
        summary: 123, // should be string
      };
      const validation = validateClassificationResult(result);
      expect(validation.valid).toBe(false);
    });

    it('should allow optional notes field', () => {
      const result = {
        ai_detected_str: false,
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: false,
        summary: 'No issues found',
        notes: { extra: 'info' },
      };
      const validation = validateClassificationResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should handle null/undefined input', () => {
      expect(validateClassificationResult(null).valid).toBe(false);
      expect(validateClassificationResult(undefined).valid).toBe(false);
    });
  });

  describe('validateCustomizeResult', () => {
    it('should return valid for correct schema', () => {
      const result = {
        final_response: 'Thank you for the report...',
        used_canned_id: 'needinfo',
      };
      const validation = validateCustomizeResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should return invalid when missing required fields', () => {
      const result = {
        final_response: 'Response text',
      };
      const validation = validateCustomizeResult(result);
      expect(validation.valid).toBe(false);
    });

    it('should allow optional notes field', () => {
      const result = {
        final_response: 'Response',
        used_canned_id: 'test',
        notes: { changes: 'Added greeting' },
      };
      const validation = validateCustomizeResult(result);
      expect(validation.valid).toBe(true);
    });
  });

  describe('validateSuggestResult', () => {
    it('should return valid for correct schema', () => {
      const result = {
        selected_responses: [
          { id: 'needinfo', reason: 'Missing STR' },
          { id: 'wontfix', customized_text: 'This is expected behavior.' },
        ],
      };
      const validation = validateSuggestResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should return invalid when selected_responses not array', () => {
      const result = {
        selected_responses: 'needinfo',
      };
      const validation = validateSuggestResult(result);
      expect(validation.valid).toBe(false);
    });

    it('should allow optional fallback_custom_text', () => {
      const result = {
        selected_responses: [],
        fallback_custom_text: 'Unable to match a canned response.',
      };
      const validation = validateSuggestResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should validate selected_response structure', () => {
      const result = {
        selected_responses: [
          { reason: 'No id field' }, // missing id
        ],
      };
      const validation = validateSuggestResult(result);
      expect(validation.valid).toBe(false);
    });
  });

  describe('buildClassificationPrompt', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Crash when clicking button',
      description: 'The app crashes when I click the submit button.',
      status: 'NEW',
      product: 'Firefox',
      component: 'General',
      comments: [
        { text: 'I can reproduce this on Windows 10.' },
        { text: 'Steps: 1. Open page 2. Click button 3. See crash' },
      ],
      attachments: [{ filename: 'crash.log', description: 'Crash log' }],
    };

    it('should include bug ID in prompt', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('123456');
    });

    it('should include bug summary in prompt', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('Crash when clicking button');
    });

    it('should include bug description in prompt', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('crashes when I click');
    });

    it('should include comments in prompt', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('Steps: 1. Open page');
    });

    it('should include attachment info in prompt', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('crash.log');
    });

    it('should include JSON output instructions', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('ai_detected_str');
    });

    it('should include conservative detection guidance', () => {
      const prompt = buildClassificationPrompt(sampleBug);
      expect(prompt.toLowerCase()).toContain('conservative');
    });

    it('should handle bug with no comments', () => {
      const bugNoComments = { ...sampleBug, comments: [] };
      const prompt = buildClassificationPrompt(bugNoComments);
      expect(prompt).toBeDefined();
      expect(prompt).toContain('123456');
    });

    it('should handle bug with no attachments', () => {
      const bugNoAttachments = { ...sampleBug, attachments: [] };
      const prompt = buildClassificationPrompt(bugNoAttachments);
      expect(prompt).toBeDefined();
    });
  });

  describe('buildCustomizePrompt', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Test bug',
      description: 'Test description',
    };

    const sampleResponse = {
      id: 'needinfo',
      title: 'Need Info',
      bodyTemplate: 'We need more information about {{issue}}.',
    };

    it('should include bug context', () => {
      const prompt = buildCustomizePrompt(sampleBug, sampleResponse);
      expect(prompt).toContain('123456');
      expect(prompt).toContain('Test bug');
    });

    it('should include canned response template', () => {
      const prompt = buildCustomizePrompt(sampleBug, sampleResponse);
      expect(prompt).toContain('needinfo');
      expect(prompt).toContain('more information');
    });

    it('should include JSON output instructions', () => {
      const prompt = buildCustomizePrompt(sampleBug, sampleResponse);
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('final_response');
    });
  });

  describe('buildSuggestPrompt', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Missing STR',
      description: 'Bug without steps',
    };

    const sampleResponses = [
      { id: 'needinfo', title: 'Need Info', bodyTemplate: 'Please provide...' },
      { id: 'wontfix', title: "Won't Fix", bodyTemplate: 'This is expected...' },
    ];

    it('should include bug context', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleResponses);
      expect(prompt).toContain('123456');
      expect(prompt).toContain('Missing STR');
    });

    it('should include all canned response options', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleResponses);
      expect(prompt).toContain('needinfo');
      expect(prompt).toContain('wontfix');
    });

    it('should include JSON output instructions', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleResponses);
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('selected_responses');
    });
  });

  describe('classifyBug', () => {
    it('should return empty result when provider is none', async () => {
      const result = await classifyBug({ id: 123 }, { provider: 'none' });
      expect(result.ai_detected_str).toBe(false);
      expect(result.ai_detected_test_attached).toBe(false);
      expect(result.summary).toBe('');
    });

    it('should return empty result when provider not configured', async () => {
      const result = await classifyBug(
        { id: 123 },
        { provider: 'gemini', transport: 'browser', apiKey: '' }
      );
      expect(result.ai_detected_str).toBe(false);
      expect(result.summary).toBe('');
    });

    it('should throw error when browser mode not supported for provider', async () => {
      await expect(
        classifyBug(
          { id: 123 },
          { provider: 'openai', transport: 'browser', apiKey: 'test' }
        )
      ).rejects.toThrow(/browser mode/i);
    });

    it('should throw error on API failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('customizeCannedResponse', () => {
    it('should return template when provider not configured', async () => {
      const response = { id: 'test', bodyTemplate: 'Original text' };
      const result = await customizeCannedResponse(
        { id: 123 },
        response,
        { provider: 'none' }
      );
      expect(result.final_response).toBe('Original text');
      expect(result.used_canned_id).toBe('test');
    });
  });

  describe('suggestCannedResponse', () => {
    it('should return empty suggestions when provider not configured', async () => {
      const result = await suggestCannedResponse(
        { id: 123 },
        [{ id: 'test' }],
        { provider: 'none' }
      );
      expect(result.selected_responses).toEqual([]);
    });
  });

  describe('Gemini integration', () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  ai_detected_str: true,
                  ai_detected_test_attached: false,
                  crashstack_present: true,
                  fuzzing_testcase: false,
                  summary: 'Crash when clicking button. Has clear STR.',
                  notes: {},
                }),
              },
            ],
          },
        },
      ],
    };

    it('should parse Gemini response correctly', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test bug' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.ai_detected_str).toBe(true);
      expect(result.crashstack_present).toBe(true);
      expect(result.summary).toContain('Crash when clicking');
    });

    it('should call correct Gemini endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'gemini', transport: 'browser', apiKey: 'my-api-key', model: 'gemini-2.0-flash' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(global.fetch.mock.calls[0][0]).toContain('gemini-2.0-flash');
      expect(global.fetch.mock.calls[0][0]).toContain('key=my-api-key');
    });

    it('should use default model when not specified', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(global.fetch.mock.calls[0][0]).toContain('gemini-2.0-flash');
    });

    it('should request JSON mime type from Gemini', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.responseMimeType).toBe('application/json');
    });

    it('should handle Gemini API error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid API key',
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'gemini', transport: 'browser', apiKey: 'bad-key' }
        )
      ).rejects.toThrow(/Gemini API error.*400/);
    });

    it('should handle empty Gemini response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] }),
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
        )
      ).rejects.toThrow(/No content/);
    });

    it('should handle Gemini response with markdown code block', async () => {
      const responseWithCodeBlock = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n{"ai_detected_str": false, "ai_detected_test_attached": true, "crashstack_present": false, "fuzzing_testcase": false, "summary": "Test"}\n```',
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithCodeBlock,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.ai_detected_test_attached).toBe(true);
    });
  });

  describe('Claude integration', () => {
    const mockClaudeResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ai_detected_str: false,
            ai_detected_test_attached: true,
            crashstack_present: false,
            fuzzing_testcase: true,
            summary: 'Fuzzing testcase found.',
            notes: { source: 'fuzzer' },
          }),
        },
      ],
    };

    it('should parse Claude response correctly', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test bug' },
        { provider: 'claude', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.ai_detected_test_attached).toBe(true);
      expect(result.fuzzing_testcase).toBe(true);
      expect(result.summary).toContain('Fuzzing testcase');
    });

    it('should call correct Claude endpoint with headers', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse,
      });

      await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'claude', transport: 'browser', apiKey: 'sk-ant-test' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }),
        })
      );
    });

    it('should use correct model in Claude request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse,
      });

      await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'claude', transport: 'browser', apiKey: 'test-key', model: 'claude-sonnet-4-5' }
      );

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-sonnet-4-5');
    });

    it('should handle Claude API error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'claude', transport: 'browser', apiKey: 'bad-key' }
        )
      ).rejects.toThrow(/Claude API error.*401/);
    });

    it('should handle empty Claude response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] }),
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'claude', transport: 'browser', apiKey: 'test-key' }
        )
      ).rejects.toThrow(/No content/);
    });
  });

  describe('backend proxy mode', () => {
    it('should call backend proxy for backend transport', async () => {
      const mockBackendResponse = {
        ai_detected_str: true,
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: false,
        summary: 'Backend processed',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'claude', transport: 'backend' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai/classify',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.ai_detected_str).toBe(true);
    });

    it('should work for openai via backend proxy', async () => {
      const mockResponse = {
        ai_detected_str: false,
        ai_detected_test_attached: false,
        crashstack_present: false,
        fuzzing_testcase: false,
        summary: 'Processed via backend',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'openai', transport: 'backend' }
      );

      expect(result.summary).toBe('Processed via backend');
    });

    it('should handle backend proxy error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'claude', transport: 'backend' }
        )
      ).rejects.toThrow(/Backend proxy error.*500/);
    });
  });

  describe('JSON parsing edge cases', () => {
    it('should handle response with extra text around JSON', async () => {
      const responseWithExtraText = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Here is the analysis:\n{"ai_detected_str": true, "ai_detected_test_attached": false, "crashstack_present": false, "fuzzing_testcase": false, "summary": "Test"}\n\nLet me know if you need more.',
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithExtraText,
      });

      const result = await classifyBug(
        { id: 123, summary: 'Test' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.ai_detected_str).toBe(true);
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid JSON at all!' }],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedResponse,
      });

      await expect(
        classifyBug(
          { id: 123, summary: 'Test' },
          { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
        )
      ).rejects.toThrow(/Failed to parse/);
    });
  });

  // ============================================================================
  // L4-F6-NEW: generateResponse tests
  // ============================================================================

  describe('validateGenerateResult', () => {
    it('should return valid for correct schema', () => {
      const result = {
        response_text: 'Thank you for the bug report...',
        suggested_actions: [
          { action: 'set-has-str', reason: 'Clear STR provided' },
        ],
        used_canned_ids: ['need-info'],
        reasoning: 'Based on the bug description...',
      };
      const validation = validateGenerateResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return valid with empty arrays', () => {
      const result = {
        response_text: 'A response',
        suggested_actions: [],
        used_canned_ids: [],
        reasoning: 'No specific actions needed',
      };
      const validation = validateGenerateResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should return invalid when response_text missing', () => {
      const result = {
        suggested_actions: [],
        reasoning: 'Test',
      };
      const validation = validateGenerateResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('response_text must be a string');
    });

    it('should return invalid when suggested_actions not array', () => {
      const result = {
        response_text: 'Response',
        suggested_actions: 'not-an-array',
        reasoning: 'Test',
      };
      const validation = validateGenerateResult(result);
      expect(validation.valid).toBe(false);
    });

    it('should validate suggested_action structure', () => {
      const result = {
        response_text: 'Response',
        suggested_actions: [{ reason: 'No action field' }],
        reasoning: 'Test',
      };
      const validation = validateGenerateResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('action'))).toBe(true);
    });

    it('should handle null/undefined input', () => {
      expect(validateGenerateResult(null).valid).toBe(false);
      expect(validateGenerateResult(undefined).valid).toBe(false);
    });
  });

  describe('buildGeneratePrompt', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Crash on startup',
      description: 'The app crashes immediately after launch.',
      status: 'NEW',
      product: 'Firefox',
      component: 'General',
      comments: [{ text: 'Seeing this on Windows 11.' }],
      attachments: [{ filename: 'log.txt', description: 'Crash log' }],
      aiSummary: 'App crashes at startup, unclear reproduction steps.',
    };

    const sampleCannedResponses = [
      { id: 'need-str', title: 'Need STR', bodyTemplate: 'Please provide steps...' },
      { id: 'need-profile', title: 'Need Profile', bodyTemplate: 'Please attach profile...' },
    ];

    it('should include bug context in prompt', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt).toContain('123456');
      expect(prompt).toContain('Crash on startup');
      expect(prompt).toContain('crashes immediately');
    });

    it('should include AI summary when available', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt).toContain('unclear reproduction steps');
    });

    it('should include canned responses when provided', () => {
      const prompt = buildGeneratePrompt(sampleBug, {
        mode: 'response',
        cannedResponses: sampleCannedResponses,
      });
      expect(prompt).toContain('need-str');
      expect(prompt).toContain('need-profile');
    });

    it('should work without canned responses', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt).toBeDefined();
      expect(prompt).toContain('123456');
    });

    it('should include response mode instructions', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt.toLowerCase()).toContain('response');
      expect(prompt.toLowerCase()).toContain('comment');
    });

    it('should include next-steps mode instructions', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'next-steps' });
      expect(prompt.toLowerCase()).toContain('next');
      expect(prompt.toLowerCase()).toContain('action');
    });

    it('should include JSON output structure', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt).toContain('response_text');
      expect(prompt).toContain('suggested_actions');
      expect(prompt).toContain('reasoning');
    });

    it('should handle bug with no comments', () => {
      const bugNoComments = { ...sampleBug, comments: [] };
      const prompt = buildGeneratePrompt(bugNoComments, { mode: 'response' });
      expect(prompt).toBeDefined();
    });
  });

  describe('generateResponse', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Test bug',
      description: 'Test description',
    };

    it('should return empty result when provider is none', async () => {
      const result = await generateResponse(sampleBug, { mode: 'response' }, { provider: 'none' });
      expect(result.response_text).toBe('');
      expect(result.suggested_actions).toEqual([]);
      expect(result.reasoning).toBe('');
    });

    it('should return empty result when provider not configured', async () => {
      const result = await generateResponse(
        sampleBug,
        { mode: 'response' },
        { provider: 'gemini', transport: 'browser', apiKey: '' }
      );
      expect(result.response_text).toBe('');
    });

    it('should throw error when browser mode not supported for provider', async () => {
      await expect(
        generateResponse(
          sampleBug,
          { mode: 'response' },
          { provider: 'openai', transport: 'browser', apiKey: 'test' }
        )
      ).rejects.toThrow(/browser mode/i);
    });

    it('should parse response correctly from Gemini', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    response_text: 'Thank you for reporting this issue.',
                    suggested_actions: [{ action: 'need-info', reason: 'Missing STR' }],
                    used_canned_ids: ['need-str'],
                    reasoning: 'Bug lacks reproduction steps.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateResponse(
        sampleBug,
        { mode: 'response' },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.response_text).toContain('Thank you');
      expect(result.suggested_actions).toHaveLength(1);
      expect(result.suggested_actions[0].action).toBe('need-info');
      expect(result.used_canned_ids).toContain('need-str');
    });

    it('should include canned responses in request when provided', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    response_text: 'Response',
                    suggested_actions: [],
                    used_canned_ids: [],
                    reasoning: 'Test',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await generateResponse(
        sampleBug,
        { mode: 'response', cannedResponses: [{ id: 'test', title: 'Test' }] },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const promptText = callBody.contents[0].parts[0].text;
      expect(promptText).toContain('test');
    });

    it('should use backend proxy when configured', async () => {
      const mockResponse = {
        response_text: 'Backend response',
        suggested_actions: [],
        used_canned_ids: [],
        reasoning: 'Processed by backend',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateResponse(
        sampleBug,
        { mode: 'response' },
        { provider: 'claude', transport: 'backend' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai/generate',
        expect.any(Object)
      );
      expect(result.response_text).toBe('Backend response');
    });
  });

  // ============================================================================
  // L4-F7-NEW: refineResponse tests
  // ============================================================================

  describe('validateRefineResult', () => {
    it('should return valid for correct schema', () => {
      const result = {
        refined_response: 'Updated response text...',
        changes_made: ['Shortened greeting', 'Added profile request'],
      };
      const validation = validateRefineResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should return valid with empty changes array', () => {
      const result = {
        refined_response: 'No changes needed',
        changes_made: [],
      };
      const validation = validateRefineResult(result);
      expect(validation.valid).toBe(true);
    });

    it('should return invalid when refined_response missing', () => {
      const result = {
        changes_made: ['Some change'],
      };
      const validation = validateRefineResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('refined_response must be a string');
    });

    it('should return invalid when changes_made not array', () => {
      const result = {
        refined_response: 'Response',
        changes_made: 'not an array',
      };
      const validation = validateRefineResult(result);
      expect(validation.valid).toBe(false);
    });

    it('should handle null/undefined input', () => {
      expect(validateRefineResult(null).valid).toBe(false);
      expect(validateRefineResult(undefined).valid).toBe(false);
    });
  });

  describe('buildRefinePrompt', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Test bug',
      description: 'Test description',
    };

    const currentResponse = 'Thank you for reporting this issue. Please provide more details.';
    const userInstruction = 'Make it shorter';

    it('should include bug context', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction, {});
      expect(prompt).toContain('123456');
      expect(prompt).toContain('Test bug');
    });

    it('should include current response', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction, {});
      expect(prompt).toContain('Thank you for reporting');
    });

    it('should include user instruction', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction, {});
      expect(prompt).toContain('Make it shorter');
    });

    it('should include selected canned response when provided', () => {
      const context = {
        selectedCannedResponse: {
          id: 'need-str',
          title: 'Need STR',
          bodyTemplate: 'Please provide steps to reproduce.',
        },
      };
      const prompt = buildRefinePrompt(sampleBug, currentResponse, 'Use the STR template', context);
      expect(prompt).toContain('need-str');
      expect(prompt).toContain('steps to reproduce');
    });

    it('should include JSON output structure', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction, {});
      expect(prompt).toContain('refined_response');
      expect(prompt).toContain('changes_made');
    });
  });

  describe('refineResponse', () => {
    const sampleBug = {
      id: 123456,
      summary: 'Test bug',
      description: 'Test description',
    };

    const currentResponse = 'Thank you for the detailed report.';
    const userInstruction = 'Make it friendlier';

    it('should return unchanged response when provider is none', async () => {
      const result = await refineResponse(
        sampleBug,
        currentResponse,
        userInstruction,
        {},
        { provider: 'none' }
      );
      expect(result.refined_response).toBe(currentResponse);
      expect(result.changes_made).toEqual([]);
    });

    it('should return unchanged response when provider not configured', async () => {
      const result = await refineResponse(
        sampleBug,
        currentResponse,
        userInstruction,
        {},
        { provider: 'gemini', transport: 'browser', apiKey: '' }
      );
      expect(result.refined_response).toBe(currentResponse);
    });

    it('should throw error when browser mode not supported', async () => {
      await expect(
        refineResponse(sampleBug, currentResponse, userInstruction, {}, {
          provider: 'openai',
          transport: 'browser',
          apiKey: 'test',
        })
      ).rejects.toThrow(/browser mode/i);
    });

    it('should parse refined response from Gemini', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    refined_response: 'Thanks so much for taking the time to report this!',
                    changes_made: ['Made greeting friendlier', 'Added appreciation'],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refineResponse(
        sampleBug,
        currentResponse,
        userInstruction,
        {},
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.refined_response).toContain('Thanks so much');
      expect(result.changes_made).toContain('Made greeting friendlier');
    });

    it('should include context canned response in prompt', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    refined_response: 'Updated with STR template',
                    changes_made: ['Incorporated STR request'],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await refineResponse(
        sampleBug,
        currentResponse,
        'Add the STR template',
        { selectedCannedResponse: { id: 'need-str', bodyTemplate: 'STR template text' } },
        { provider: 'gemini', transport: 'browser', apiKey: 'test-key' }
      );

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const promptText = callBody.contents[0].parts[0].text;
      expect(promptText).toContain('need-str');
      expect(promptText).toContain('STR template text');
    });

    it('should use backend proxy when configured', async () => {
      const mockResponse = {
        refined_response: 'Backend refined',
        changes_made: ['Processed by backend'],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refineResponse(
        sampleBug,
        currentResponse,
        userInstruction,
        {},
        { provider: 'claude', transport: 'backend' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/ai/refine',
        expect.any(Object)
      );
      expect(result.refined_response).toBe('Backend refined');
    });

    it('should handle Claude response format', async () => {
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refined_response: 'Claude refined response',
              changes_made: ['Made it clearer'],
            }),
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse,
      });

      const result = await refineResponse(
        sampleBug,
        currentResponse,
        userInstruction,
        {},
        { provider: 'claude', transport: 'browser', apiKey: 'test-key' }
      );

      expect(result.refined_response).toBe('Claude refined response');
    });
  });
});
