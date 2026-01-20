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
 * Prompts are centralized in prompts.js for consistency across all providers.
 *
 * @module ai
 */

import * as prompts from './prompts.js';
import * as aiLogger from './aiLogger.js';

/** Supported AI providers */
export const PROVIDERS = {
  GEMINI: 'gemini',
  CLAUDE: 'claude',
  OPENAI: 'openai',
  GROK: 'grok',
  CUSTOM: 'custom',
  NONE: 'none',
};

/** Default models for each provider */
export const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  claude: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  grok: 'grok-2',
};

/** Transport modes */
export const TRANSPORT_MODES = {
  BROWSER: 'browser',
  BACKEND: 'backend',
};

/** Providers that support browser mode */
const BROWSER_MODE_PROVIDERS = ['gemini', 'claude'];

/** Default backend proxy base URL (can be overridden in config) */
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

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
 * Check if a provider supports browser mode.
 * @param {string} provider - Provider name
 * @returns {boolean} True if browser mode supported
 */
export function supportsBrowserMode(provider) {
  return BROWSER_MODE_PROVIDERS.includes(provider);
}

/**
 * Check if a provider configuration is valid and ready to use.
 * @param {Object} config - Provider configuration
 * @returns {boolean} True if configured
 */
export function isProviderConfigured(config) {
  if (!config || config.provider === 'none' || !config.provider) {
    return false;
  }

  // Backend mode doesn't require API key in frontend
  if (config.transport === 'backend') {
    return true;
  }

  // Browser mode requires API key
  if (!config.apiKey) {
    return false;
  }

  // Custom provider also needs baseUrl
  if (config.provider === 'custom' && !config.baseUrl) {
    return false;
  }

  return true;
}

/**
 * Validate a classification result against the schema.
 * @param {Object} result - Result to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateClassificationResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  const requiredBooleans = [
    'ai_detected_str',
    'ai_detected_test_attached',
    'crashstack_present',
    'fuzzing_testcase',
  ];

  for (const field of requiredBooleans) {
    if (typeof result[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  }

  if (typeof result.summary !== 'string') {
    errors.push('summary must be a string');
  }

  // Validate new optional fields (warnings only, not errors)
  if (result.suggested_severity !== undefined && typeof result.suggested_severity !== 'string') {
    console.warn('[ai] suggested_severity should be a string');
  }
  if (result.suggested_priority !== undefined && typeof result.suggested_priority !== 'string') {
    console.warn('[ai] suggested_priority should be a string');
  }
  if (result.suggested_actions !== undefined && !Array.isArray(result.suggested_actions)) {
    console.warn('[ai] suggested_actions should be an array');
  }
  if (result.triage_reasoning !== undefined && typeof result.triage_reasoning !== 'string') {
    console.warn('[ai] triage_reasoning should be a string');
  }
  if (result.suggested_canned_id !== undefined && typeof result.suggested_canned_id !== 'string') {
    console.warn('[ai] suggested_canned_id should be a string');
  }
  if (result.draft_response !== undefined && typeof result.draft_response !== 'string') {
    console.warn('[ai] draft_response should be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a suggest response result against the schema.
 * @param {Object} result - Result to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSuggestResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  if (typeof result.suggested_response_id !== 'string') {
    errors.push('suggested_response_id must be a string');
  }

  if (typeof result.draft_response !== 'string') {
    errors.push('draft_response must be a string');
  }

  // reasoning is optional
  if (result.reasoning !== undefined && typeof result.reasoning !== 'string') {
    errors.push('reasoning must be a string if provided');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a generate response result against the schema.
 * @param {Object} result - Result to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGenerateResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  if (typeof result.response_text !== 'string') {
    errors.push('response_text must be a string');
  }

  if (!Array.isArray(result.suggested_actions)) {
    errors.push('suggested_actions must be an array');
  } else {
    for (let i = 0; i < result.suggested_actions.length; i++) {
      const item = result.suggested_actions[i];
      if (!item || typeof item.action !== 'string') {
        errors.push(`suggested_actions[${i}] must have an action string`);
      }
    }
  }

  if (result.used_canned_ids !== undefined && !Array.isArray(result.used_canned_ids)) {
    errors.push('used_canned_ids must be an array');
  }

  if (typeof result.reasoning !== 'string') {
    errors.push('reasoning must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a refine response result against the schema.
 * @param {Object} result - Result to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRefineResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  if (typeof result.refined_response !== 'string') {
    errors.push('refined_response must be a string');
  }

  if (!Array.isArray(result.changes_made)) {
    errors.push('changes_made must be an array');
  }

  return { valid: errors.length === 0, errors };
}

// Re-export prompt functions from centralized prompts module for backward compatibility
// These are the single source of truth for all AI prompts
export const buildClassificationPrompt = prompts.buildClassifyPrompt;
export const buildSuggestPrompt = prompts.buildSuggestPrompt;
export const buildGeneratePrompt = prompts.buildGeneratePrompt;
export const buildRefinePrompt = prompts.buildRefinePrompt;

/**
 * Create an empty/default classification result.
 * @returns {ClassificationResult}
 */
function emptyClassificationResult() {
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
 * Parse JSON from AI response text.
 * Handles markdown code blocks and raw JSON.
 * @param {string} text - Response text
 * @returns {Object|null} Parsed JSON or null
 */
function parseJsonFromResponse(text) {
  if (!text) return null;

  // Try to extract JSON from markdown code block
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // Continue to try other methods
    }
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue
    }
  }

  // Try parsing the whole text as JSON
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

/**
 * Call Gemini API in browser mode.
 * @param {string} prompt - The prompt
 * @param {Object} config - Provider config
 * @returns {Promise<string>} Response text
 */
async function callGeminiBrowser(prompt, config) {
  const model = config.model || DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No content in Gemini response');
  }

  return text;
}

/**
 * Call Claude API in browser mode.
 * @param {string} prompt - The prompt
 * @param {Object} config - Provider config
 * @returns {Promise<string>} Response text
 */
async function callClaudeBrowser(prompt, config) {
  const model = config.model || DEFAULT_MODELS.claude;
  const url = 'https://api.anthropic.com/v1/messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Claude response
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error('No content in Claude response');
  }

  return text;
}

/**
 * Call backend proxy for AI request.
 * @param {string} task - Task type (classify, customize, suggest)
 * @param {Object} payload - Request payload
 * @param {Object} config - Provider config (should include backendUrl)
 * @returns {Promise<Object>} Parsed response
 */
async function callBackendProxy(task, payload, config) {
  // If backendUrl is empty, use relative path (same-origin)
  // This allows the backend to serve both frontend and API from one server
  const baseUrl = config.backendUrl || '';
  const url = `${baseUrl}/api/ai/${task}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: config.provider,
      model: config.model || DEFAULT_MODELS[config.provider],
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend proxy error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Classify a bug using AI.
 * @param {Object} bug - Bug object with description, comments, attachments
 * @param {Object} providerConfig - Provider configuration
 * @param {Object} [options] - Optional classification options
 * @param {Object[]} [options.cannedResponses] - Canned responses for auto-suggestion
 * @returns {Promise<ClassificationResult>} Classification result
 */
export async function classifyBug(bug, providerConfig, options = {}) {
  // Return empty result if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning empty result');
    return emptyClassificationResult();
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  // Build prompt with canned responses if available
  const cannedResponses = options.cannedResponses || [];
  const prompt = buildClassificationPrompt(bug, cannedResponses);
  const schema = prompts.getSchemaString('classify');

  // Start logging
  const logId = aiLogger.startEntry('classify', { prompt, schema, bugId: bug?.id }, providerConfig, { bugId: String(bug?.id || '') });

  let responseText;

  try {
    if (transport === 'backend') {
      // Use backend proxy with centralized prompt and schema
      const result = await callBackendProxy('classify', { bug, prompt, schema }, providerConfig);
      aiLogger.completeEntry(logId, result);
      return result;
    } else {
      // Browser mode
      if (provider === 'gemini') {
        responseText = await callGeminiBrowser(prompt, providerConfig);
      } else if (provider === 'claude') {
        responseText = await callClaudeBrowser(prompt, providerConfig);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    }

    // Parse response
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) {
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate
    const validation = validateClassificationResult(parsed);
    if (!validation.valid) {
      console.warn('[ai] Classification result validation errors:', validation.errors);
      // Return what we got, filling in defaults for missing fields
      const result = {
        ai_detected_str: Boolean(parsed.ai_detected_str),
        ai_detected_test_attached: Boolean(parsed.ai_detected_test_attached),
        crashstack_present: Boolean(parsed.crashstack_present),
        fuzzing_testcase: Boolean(parsed.fuzzing_testcase),
        summary: String(parsed.summary || ''),
        suggested_severity: parsed.suggested_severity || '--',
        suggested_priority: parsed.suggested_priority || '--',
        suggested_actions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
        triage_reasoning: parsed.triage_reasoning || '',
        suggested_canned_id: parsed.suggested_canned_id || '',
        draft_response: parsed.draft_response || '',
        notes: parsed.notes || {},
      };
      aiLogger.completeEntry(logId, { raw: responseText, parsed: result, validationErrors: validation.errors });
      return result;
    }

    aiLogger.completeEntry(logId, { raw: responseText, parsed });
    return parsed;
  } catch (error) {
    aiLogger.failEntry(logId, error);
    throw error;
  }
}

/**
 * Suggest the best canned response for a bug.
 * @param {Object} bug - Bug object
 * @param {Object[]} cannedResponses - All available canned responses
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} { suggested_response_id, draft_response, reasoning }
 */
export async function suggestCannedResponse(bug, cannedResponses, providerConfig) {
  // Return empty suggestion if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning empty suggestion');
    return {
      suggested_response_id: '',
      draft_response: '',
      reasoning: '',
    };
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildSuggestPrompt(bug, cannedResponses);
  const schema = prompts.getSchemaString('suggest');

  // Start logging
  const logId = aiLogger.startEntry('suggest', { prompt, schema, cannedResponseCount: cannedResponses?.length }, providerConfig, { bugId: String(bug?.id || '') });

  let responseText;

  try {
    if (transport === 'backend') {
      // Use backend proxy with centralized prompt and schema
      const result = await callBackendProxy('suggest-response', { bug, cannedResponses, prompt, schema }, providerConfig);
      aiLogger.completeEntry(logId, result);
      return result;
    } else {
      if (provider === 'gemini') {
        responseText = await callGeminiBrowser(prompt, providerConfig);
      } else if (provider === 'claude') {
        responseText = await callClaudeBrowser(prompt, providerConfig);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    }

    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const validation = validateSuggestResult(parsed);
    if (!validation.valid) {
      console.warn('[ai] Suggest result validation errors:', validation.errors);
    }

    const result = {
      suggested_response_id: String(parsed.suggested_response_id || ''),
      draft_response: String(parsed.draft_response || ''),
      reasoning: String(parsed.reasoning || ''),
    };

    aiLogger.completeEntry(logId, { raw: responseText, parsed: result });
    return result;
  } catch (error) {
    aiLogger.failEntry(logId, error);
    throw error;
  }
}

/**
 * Create an empty/default generate response result.
 * @returns {Object}
 */
function emptyGenerateResult() {
  return {
    response_text: '',
    suggested_actions: [],
    used_canned_ids: [],
    reasoning: '',
  };
}

/**
 * Create an empty/default refine response result.
 * @param {string} currentResponse - The original response
 * @returns {Object}
 */
function emptyRefineResult(currentResponse = '') {
  return {
    refined_response: currentResponse,
    changes_made: [],
  };
}

/**
 * Generate a response or next-step suggestion for a bug from scratch.
 * @param {Object} bug - Bug object with description, comments, attachments
 * @param {Object} options - Generation options
 * @param {string} [options.mode] - 'response' (comment draft) or 'next-steps' (triage actions)
 * @param {Object[]} [options.cannedResponses] - Optional canned responses for reference
 * @param {Object} providerConfig - AI provider configuration
 * @returns {Promise<Object>} { response_text, suggested_actions[], used_canned_ids[], reasoning }
 */
export async function generateResponse(bug, options, providerConfig) {
  // Return empty result if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning empty result');
    return emptyGenerateResult();
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildGeneratePrompt(bug, options);
  const schema = prompts.getSchemaString('generate');

  // Start logging
  const logId = aiLogger.startEntry('generate', { prompt, schema, mode: options?.mode }, providerConfig, { bugId: String(bug?.id || '') });

  let responseText;

  try {
    if (transport === 'backend') {
      // Use backend proxy with centralized prompt and schema
      const result = await callBackendProxy('generate', { bug, options, prompt, schema }, providerConfig);
      aiLogger.completeEntry(logId, result);
      return result;
    } else {
      // Browser mode
      if (provider === 'gemini') {
        responseText = await callGeminiBrowser(prompt, providerConfig);
      } else if (provider === 'claude') {
        responseText = await callClaudeBrowser(prompt, providerConfig);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    }

    // Parse response
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) {
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate
    const validation = validateGenerateResult(parsed);
    if (!validation.valid) {
      console.warn('[ai] Generate result validation errors:', validation.errors);
    }

    const result = {
      response_text: String(parsed.response_text || ''),
      suggested_actions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
      used_canned_ids: Array.isArray(parsed.used_canned_ids) ? parsed.used_canned_ids : [],
      reasoning: String(parsed.reasoning || ''),
    };

    aiLogger.completeEntry(logId, { raw: responseText, parsed: result });
    return result;
  } catch (error) {
    aiLogger.failEntry(logId, error);
    throw error;
  }
}

/**
 * Refine a response based on user instructions.
 * @param {Object} bug - Bug object
 * @param {string} currentResponse - Current response text
 * @param {string} userInstruction - User's refinement instruction
 * @param {Object} [context] - Optional context
 * @param {Object} [context.selectedCannedResponse] - A canned response to incorporate
 * @param {Object} providerConfig - AI provider configuration
 * @returns {Promise<Object>} { refined_response, changes_made[] }
 */
export async function refineResponse(bug, currentResponse, userInstruction, context, providerConfig) {
  // Return unchanged if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning unchanged response');
    return emptyRefineResult(currentResponse);
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildRefinePrompt(bug, currentResponse, userInstruction, context || {});
  const schema = prompts.getSchemaString('refine');

  // Start logging
  const logId = aiLogger.startEntry('refine', { prompt, schema, instruction: userInstruction, currentResponseLength: currentResponse?.length }, providerConfig, { bugId: String(bug?.id || '') });

  let responseText;

  try {
    if (transport === 'backend') {
      // Use backend proxy with centralized prompt and schema
      const result = await callBackendProxy('refine', { bug, currentResponse, userInstruction, context, prompt, schema }, providerConfig);
      aiLogger.completeEntry(logId, result);
      return result;
    } else {
      // Browser mode
      if (provider === 'gemini') {
        responseText = await callGeminiBrowser(prompt, providerConfig);
      } else if (provider === 'claude') {
        responseText = await callClaudeBrowser(prompt, providerConfig);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    }

    // Parse response
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) {
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate
    const validation = validateRefineResult(parsed);
    if (!validation.valid) {
      console.warn('[ai] Refine result validation errors:', validation.errors);
    }

    const result = {
      refined_response: String(parsed.refined_response || currentResponse),
      changes_made: Array.isArray(parsed.changes_made) ? parsed.changes_made : [],
    };

    aiLogger.completeEntry(logId, { raw: responseText, parsed: result });
    return result;
  } catch (error) {
    aiLogger.failEntry(logId, error);
    throw error;
  }
}

/**
 * Validate test page result.
 * @param {Object} result - Result to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateTestPageResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  if (typeof result.can_generate !== 'boolean') {
    errors.push('can_generate must be a boolean');
  }

  if (typeof result.html_content !== 'string') {
    errors.push('html_content must be a string');
  }

  if (typeof result.reason !== 'string') {
    errors.push('reason must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Return an empty test page result.
 * @param {string} [reason=''] - Reason for empty result
 * @returns {Object} Empty result
 */
function emptyTestPageResult(reason = '') {
  return {
    can_generate: false,
    html_content: '',
    reason: reason || 'AI provider not configured',
  };
}

/**
 * Build the test page prompt using the centralized prompts module.
 * @param {Object} bug - Bug object
 * @returns {string} The prompt text
 */
function buildTestPagePrompt(bug) {
  return prompts.buildTestPagePrompt(bug);
}

/**
 * Generate a test page from a bug report.
 * @param {Object} bug - Bug object with description, comments, attachments
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} { can_generate, html_content, reason }
 */
export async function generateTestPage(bug, providerConfig) {
  // Return empty result if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning empty test page result');
    return emptyTestPageResult();
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildTestPagePrompt(bug);
  const schema = prompts.getSchemaString('testpage');

  // Start logging
  const logId = aiLogger.startEntry('testpage', { prompt, schema, bugId: bug?.id }, providerConfig, { bugId: String(bug?.id || '') });

  let responseText;

  try {
    if (transport === 'backend') {
      // Use backend proxy with centralized prompt and schema
      const result = await callBackendProxy('testpage', { bug, prompt, schema }, providerConfig);
      aiLogger.completeEntry(logId, result);
      return result;
    } else {
      // Browser mode
      if (provider === 'gemini') {
        responseText = await callGeminiBrowser(prompt, providerConfig);
      } else if (provider === 'claude') {
        responseText = await callClaudeBrowser(prompt, providerConfig);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    }

    // Parse response
    const parsed = parseJsonFromResponse(responseText);
    if (!parsed) {
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate
    const validation = validateTestPageResult(parsed);
    if (!validation.valid) {
      console.warn('[ai] Test page result validation errors:', validation.errors);
    }

    const result = {
      can_generate: Boolean(parsed.can_generate),
      html_content: String(parsed.html_content || ''),
      reason: String(parsed.reason || ''),
    };

    aiLogger.completeEntry(logId, { raw: responseText, parsed: result });
    return result;
  } catch (error) {
    aiLogger.failEntry(logId, error);
    throw error;
  }
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

console.log('[ai] Module loaded');
