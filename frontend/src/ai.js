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

/** Backend proxy base URL */
const BACKEND_PROXY_URL = 'http://localhost:3000';

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

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a customize response result against the schema.
 * @param {Object} result - Result to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCustomizeResult(result) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be an object'] };
  }

  if (typeof result.final_response !== 'string') {
    errors.push('final_response must be a string');
  }

  if (typeof result.used_canned_id !== 'string') {
    errors.push('used_canned_id must be a string');
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

  if (!Array.isArray(result.selected_responses)) {
    errors.push('selected_responses must be an array');
  } else {
    for (let i = 0; i < result.selected_responses.length; i++) {
      const item = result.selected_responses[i];
      if (!item || typeof item.id !== 'string') {
        errors.push(`selected_responses[${i}] must have an id string`);
      }
    }
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

/**
 * Build the classification prompt for a bug.
 * @param {Object} bug - Bug object
 * @returns {string} Prompt string
 */
export function buildClassificationPrompt(bug) {
  const parts = [];

  parts.push(`You are analyzing Mozilla Bugzilla bug #${bug.id || 'unknown'}.`);
  parts.push('');
  parts.push('## Bug Information');
  parts.push(`**Summary:** ${bug.summary || 'No summary'}`);
  parts.push(`**Status:** ${bug.status || 'Unknown'}`);
  parts.push(`**Product:** ${bug.product || 'Unknown'}`);
  parts.push(`**Component:** ${bug.component || 'Unknown'}`);
  parts.push('');

  if (bug.description) {
    parts.push('## Description');
    parts.push(bug.description);
    parts.push('');
  }

  if (bug.comments && bug.comments.length > 0) {
    parts.push('## Comments');
    bug.comments.forEach((comment, i) => {
      const text = comment.text || comment.raw_text || '';
      parts.push(`### Comment ${i + 1}`);
      parts.push(text.substring(0, 2000)); // Truncate long comments
      parts.push('');
    });
  }

  if (bug.attachments && bug.attachments.length > 0) {
    parts.push('## Attachments');
    bug.attachments.forEach((att) => {
      parts.push(`- **${att.filename || 'unnamed'}**: ${att.description || 'No description'}`);
    });
    parts.push('');
  }

  parts.push('## Task');
  parts.push('Analyze this bug and determine:');
  parts.push('1. Does it contain clear Steps to Reproduce (STR)?');
  parts.push('2. Does it reference or include a test case?');
  parts.push('3. Is there a crash stack or sanitizer output?');
  parts.push('4. Is it a fuzzing-derived testcase?');
  parts.push('5. Provide a brief 1-3 sentence summary.');
  parts.push('');
  parts.push('**Important**: Be conservative in your detection. Only mark ai_detected_str');
  parts.push('as true if there are clear, explicit steps. Only mark ai_detected_test_attached');
  parts.push('as true if a testcase file or link is clearly referenced.');
  parts.push('');
  parts.push('Return ONLY a JSON object with this exact structure:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "ai_detected_str": boolean,');
  parts.push('  "ai_detected_test_attached": boolean,');
  parts.push('  "crashstack_present": boolean,');
  parts.push('  "fuzzing_testcase": boolean,');
  parts.push('  "summary": "string (1-3 sentences)",');
  parts.push('  "notes": {}');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * Build the customize prompt for a canned response.
 * @param {Object} bug - Bug object
 * @param {Object} cannedResponse - Canned response template
 * @returns {string} Prompt string
 */
export function buildCustomizePrompt(bug, cannedResponse) {
  const parts = [];

  parts.push(`You are helping triage Mozilla Bugzilla bug #${bug.id || 'unknown'}.`);
  parts.push('');
  parts.push('## Bug Context');
  parts.push(`**Summary:** ${bug.summary || 'No summary'}`);
  if (bug.description) {
    parts.push(`**Description:** ${bug.description.substring(0, 1000)}`);
  }
  parts.push('');

  parts.push('## Selected Canned Response Template');
  parts.push(`**ID:** ${cannedResponse.id || 'unknown'}`);
  parts.push(`**Title:** ${cannedResponse.title || 'Untitled'}`);
  parts.push('**Template:**');
  parts.push(cannedResponse.bodyTemplate || '');
  parts.push('');

  parts.push('## Task');
  parts.push('Customize this canned response for the specific bug.');
  parts.push('- Keep the response polite and professional');
  parts.push('- Replace any placeholders with bug-specific information');
  parts.push('- Keep it concise and actionable');
  parts.push('');
  parts.push('Return ONLY a JSON object with this exact structure:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "final_response": "string (the customized response text)",');
  parts.push('  "used_canned_id": "string (the canned response ID)",');
  parts.push('  "notes": {}');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * Build the suggest prompt for recommending canned responses.
 * @param {Object} bug - Bug object
 * @param {Object[]} cannedResponses - Available canned responses
 * @returns {string} Prompt string
 */
export function buildSuggestPrompt(bug, cannedResponses) {
  const parts = [];

  parts.push(`You are helping triage Mozilla Bugzilla bug #${bug.id || 'unknown'}.`);
  parts.push('');
  parts.push('## Bug Context');
  parts.push(`**Summary:** ${bug.summary || 'No summary'}`);
  if (bug.description) {
    parts.push(`**Description:** ${bug.description.substring(0, 1000)}`);
  }
  parts.push('');

  parts.push('## Available Canned Responses');
  cannedResponses.forEach((resp, i) => {
    parts.push(`### ${i + 1}. ${resp.id || 'unknown'}`);
    parts.push(`**Title:** ${resp.title || 'Untitled'}`);
    if (resp.bodyTemplate) {
      parts.push(`**Template:** ${resp.bodyTemplate.substring(0, 200)}...`);
    }
    parts.push('');
  });

  parts.push('## Task');
  parts.push('Select the most appropriate canned response(s) for this bug.');
  parts.push('You may select 0-3 responses, ranked by relevance.');
  parts.push('Optionally provide a customized version of each selected response.');
  parts.push('');
  parts.push('Return ONLY a JSON object with this exact structure:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "selected_responses": [');
  parts.push('    { "id": "string", "reason": "string (optional)", "customized_text": "string (optional)" }');
  parts.push('  ],');
  parts.push('  "fallback_custom_text": "string (optional, if no canned response fits)"');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * Build the generate response prompt for a bug.
 * @param {Object} bug - Bug object
 * @param {Object} options - Generation options
 * @param {string} [options.mode] - 'response' or 'next-steps'
 * @param {Object[]} [options.cannedResponses] - Optional canned responses for reference
 * @returns {string} Prompt string
 */
export function buildGeneratePrompt(bug, options = {}) {
  const mode = options.mode || 'response';
  const parts = [];

  parts.push(`You are a Mozilla bug triage expert analyzing bug #${bug.id || 'unknown'}.`);
  parts.push('');
  parts.push('## Bug Information');
  parts.push(`**Summary:** ${bug.summary || 'No summary'}`);
  parts.push(`**Status:** ${bug.status || 'Unknown'}`);
  parts.push(`**Product:** ${bug.product || 'Unknown'}`);
  parts.push(`**Component:** ${bug.component || 'Unknown'}`);
  parts.push('');

  if (bug.description) {
    parts.push('## Description');
    parts.push(bug.description.substring(0, 2000));
    parts.push('');
  }

  if (bug.aiSummary) {
    parts.push('## AI Summary (from prior analysis)');
    parts.push(bug.aiSummary);
    parts.push('');
  }

  if (bug.comments && bug.comments.length > 0) {
    parts.push('## Recent Comments');
    const recentComments = bug.comments.slice(-5); // Last 5 comments
    recentComments.forEach((comment, i) => {
      const text = comment.text || comment.raw_text || '';
      parts.push(`### Comment ${bug.comments.length - recentComments.length + i + 1}`);
      parts.push(text.substring(0, 1000));
      parts.push('');
    });
  }

  if (bug.attachments && bug.attachments.length > 0) {
    parts.push('## Attachments');
    bug.attachments.forEach((att) => {
      parts.push(`- **${att.filename || 'unnamed'}**: ${att.description || 'No description'}`);
    });
    parts.push('');
  }

  // Include canned responses as reference if provided
  if (options.cannedResponses && options.cannedResponses.length > 0) {
    parts.push('## Available Canned Responses (for reference)');
    options.cannedResponses.forEach((resp) => {
      parts.push(`- **${resp.id}**: ${resp.title || resp.id}`);
      if (resp.bodyTemplate) {
        parts.push(`  Template: ${resp.bodyTemplate.substring(0, 150)}...`);
      }
    });
    parts.push('');
  }

  parts.push('## Task');

  if (mode === 'next-steps') {
    parts.push('Analyze this bug and recommend the next triage actions.');
    parts.push('Consider:');
    parts.push('- Does the bug need more information? (STR, profile, testcase)');
    parts.push('- Should any flags be set? (Has STR, Need Info)');
    parts.push('- Is this a duplicate or known issue?');
    parts.push('- What priority/severity seems appropriate?');
  } else {
    parts.push('Draft a polite, professional triage comment for this bug.');
    parts.push('The response should:');
    parts.push('- Thank the reporter if appropriate');
    parts.push('- Be concise and actionable');
    parts.push('- Request specific missing information if needed');
    parts.push('- Use a helpful, welcoming tone');
  }
  parts.push('');

  if (options.cannedResponses && options.cannedResponses.length > 0) {
    parts.push('If any of the canned responses above are applicable, you may incorporate their structure.');
    parts.push('');
  }

  parts.push('Return ONLY a JSON object with this exact structure:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "response_text": "string (the triage comment to post)",');
  parts.push('  "suggested_actions": [');
  parts.push('    { "action": "string (e.g., set-has-str, need-info, close-duplicate)", "reason": "string" }');
  parts.push('  ],');
  parts.push('  "used_canned_ids": ["string (IDs of canned responses referenced, if any)"],');
  parts.push('  "reasoning": "string (brief explanation of your triage approach)"');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * Build the refine response prompt.
 * @param {Object} bug - Bug object
 * @param {string} currentResponse - Current response text
 * @param {string} userInstruction - User's refinement instruction
 * @param {Object} context - Optional context
 * @param {Object} [context.selectedCannedResponse] - A canned response to incorporate
 * @returns {string} Prompt string
 */
export function buildRefinePrompt(bug, currentResponse, userInstruction, context = {}) {
  const parts = [];

  parts.push(`You are refining a triage response for Mozilla bug #${bug.id || 'unknown'}.`);
  parts.push('');
  parts.push('## Bug Context');
  parts.push(`**Summary:** ${bug.summary || 'No summary'}`);
  if (bug.description) {
    parts.push(`**Description:** ${bug.description.substring(0, 500)}`);
  }
  parts.push('');

  parts.push('## Current Response');
  parts.push('```');
  parts.push(currentResponse);
  parts.push('```');
  parts.push('');

  parts.push('## User Instruction');
  parts.push(userInstruction);
  parts.push('');

  if (context.selectedCannedResponse) {
    parts.push('## Reference Canned Response');
    parts.push(`**ID:** ${context.selectedCannedResponse.id}`);
    parts.push(`**Title:** ${context.selectedCannedResponse.title || 'Untitled'}`);
    if (context.selectedCannedResponse.bodyTemplate) {
      parts.push('**Template:**');
      parts.push(context.selectedCannedResponse.bodyTemplate);
    }
    parts.push('');
  }

  parts.push('## Task');
  parts.push('Apply the user instruction to refine the current response.');
  parts.push('Keep the response professional and appropriate for a Mozilla bug comment.');
  parts.push('');
  parts.push('Return ONLY a JSON object with this exact structure:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "refined_response": "string (the updated response text)",');
  parts.push('  "changes_made": ["string (brief description of each change made)"]');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

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
 * @param {Object} config - Provider config
 * @returns {Promise<Object>} Parsed response
 */
async function callBackendProxy(task, payload, config) {
  const url = `${BACKEND_PROXY_URL}/api/ai/${task}`;

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
 * @returns {Promise<ClassificationResult>} Classification result
 */
export async function classifyBug(bug, providerConfig) {
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

  const prompt = buildClassificationPrompt(bug);

  let responseText;

  if (transport === 'backend') {
    // Use backend proxy
    const result = await callBackendProxy('classify', { bug }, providerConfig);
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
    return {
      ai_detected_str: Boolean(parsed.ai_detected_str),
      ai_detected_test_attached: Boolean(parsed.ai_detected_test_attached),
      crashstack_present: Boolean(parsed.crashstack_present),
      fuzzing_testcase: Boolean(parsed.fuzzing_testcase),
      summary: String(parsed.summary || ''),
      notes: parsed.notes || {},
    };
  }

  return parsed;
}

/**
 * Customize a canned response for a specific bug.
 * @param {Object} bug - Bug object
 * @param {Object} cannedResponse - Selected canned response
 * @param {Object} providerConfig - Provider configuration
 * @returns {Promise<Object>} { final_response, used_canned_id, notes }
 */
export async function customizeCannedResponse(bug, cannedResponse, providerConfig) {
  // Return template if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning template');
    return {
      final_response: cannedResponse?.bodyTemplate || '',
      used_canned_id: cannedResponse?.id || '',
      notes: {},
    };
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildCustomizePrompt(bug, cannedResponse);

  let responseText;

  if (transport === 'backend') {
    const result = await callBackendProxy('customize', { bug, cannedResponse }, providerConfig);
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

  const validation = validateCustomizeResult(parsed);
  if (!validation.valid) {
    console.warn('[ai] Customize result validation errors:', validation.errors);
  }

  return {
    final_response: String(parsed.final_response || cannedResponse?.bodyTemplate || ''),
    used_canned_id: String(parsed.used_canned_id || cannedResponse?.id || ''),
    notes: parsed.notes || {},
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
  // Return empty suggestions if not configured
  if (!isProviderConfigured(providerConfig)) {
    console.log('[ai] Provider not configured, returning empty suggestions');
    return {
      selected_responses: [],
      fallback_custom_text: '',
    };
  }

  const provider = providerConfig.provider;
  const transport = providerConfig.transport || 'browser';

  // Check browser mode support
  if (transport === 'browser' && !supportsBrowserMode(provider)) {
    throw new Error(`Provider "${provider}" does not support browser mode. Use backend mode instead.`);
  }

  const prompt = buildSuggestPrompt(bug, cannedResponses);

  let responseText;

  if (transport === 'backend') {
    const result = await callBackendProxy('suggest', { bug, cannedResponses }, providerConfig);
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

  return {
    selected_responses: Array.isArray(parsed.selected_responses) ? parsed.selected_responses : [],
    fallback_custom_text: String(parsed.fallback_custom_text || ''),
  };
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

  let responseText;

  if (transport === 'backend') {
    // Use backend proxy
    const result = await callBackendProxy('generate', { bug, options }, providerConfig);
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

  return {
    response_text: String(parsed.response_text || ''),
    suggested_actions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
    used_canned_ids: Array.isArray(parsed.used_canned_ids) ? parsed.used_canned_ids : [],
    reasoning: String(parsed.reasoning || ''),
  };
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

  let responseText;

  if (transport === 'backend') {
    // Use backend proxy
    const result = await callBackendProxy('refine', { bug, currentResponse, userInstruction, context }, providerConfig);
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

  return {
    refined_response: String(parsed.refined_response || currentResponse),
    changes_made: Array.isArray(parsed.changes_made) ? parsed.changes_made : [],
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

console.log('[ai] Module loaded');
