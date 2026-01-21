/**
 * @fileoverview Centralized AI prompts module.
 *
 * This module contains all AI prompts used across the application.
 * It serves as the single source of truth for prompts used in:
 * - Browser mode (Gemini, Claude API)
 * - Backend mode (Claude CLI, future Gemini CLI)
 *
 * @module prompts
 */

/**
 * JSON schemas for structured output (used by Claude CLI).
 * These schemas ensure consistent output format across all providers.
 */
export const SCHEMAS = {
  classify: {
    type: 'object',
    properties: {
      ai_detected_str: {
        type: 'boolean',
        description: 'True if clear, specific steps to reproduce are found that would allow >70% reproducibility',
      },
      ai_detected_test_attached: {
        type: 'boolean',
        description: 'True if a testcase file, reproduction HTML/JS, or test code is clearly referenced',
      },
      crashstack_present: {
        type: 'boolean',
        description: 'True if crash stack traces, AddressSanitizer/ASan output, or similar is present',
      },
      fuzzing_testcase: {
        type: 'boolean',
        description: 'True if this appears to be from fuzzing (fuzzilli, oss-fuzz, grizzly, etc.)',
      },
      summary: {
        type: 'string',
        description: 'Brief 1-3 sentence summary of the bug for triagers',
      },
      suggested_severity: {
        type: 'string',
        enum: ['--', 'S1', 'S2', 'S3', 'S4', 'N/A'],
        description: 'Suggested severity: S1=catastrophic, S2=serious, S3=normal, S4=trivial, N/A=task/enhancement',
      },
      suggested_priority: {
        type: 'string',
        enum: ['--', 'P1', 'P2', 'P3', 'P5'],
        description: 'Suggested priority: P1=current release, P2=next release, P3=backlog, P5=wontfix but accept patch',
      },
      suggested_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action like need-info, set-has-str, close-duplicate, assign-component' },
            reason: { type: 'string', description: 'Why this action is recommended' },
          },
          required: ['action', 'reason'],
        },
        description: 'Recommended triage actions',
      },
      triage_reasoning: {
        type: 'string',
        description: 'Brief explanation of the overall triage assessment',
      },
      suggested_canned_id: {
        type: 'string',
        description: 'ID of the most appropriate canned response template, or empty string if none fit',
      },
      draft_response: {
        type: 'string',
        description: 'A customized response draft based on the selected canned template, tailored for this specific bug',
      },
    },
    required: ['ai_detected_str', 'ai_detected_test_attached', 'crashstack_present', 'fuzzing_testcase', 'summary', 'suggested_severity', 'suggested_priority', 'suggested_actions', 'triage_reasoning', 'suggested_canned_id', 'draft_response'],
  },

  suggest: {
    type: 'object',
    properties: {
      suggested_response_id: {
        type: 'string',
        description: 'The ID of the most appropriate canned response',
      },
      draft_response: {
        type: 'string',
        description: 'A draft response customized for this specific bug',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this response was chosen',
      },
    },
    required: ['suggested_response_id', 'draft_response'],
  },

  generate: {
    type: 'object',
    properties: {
      response_text: {
        type: 'string',
        description: 'The triage comment to post',
      },
      suggested_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action like set-has-str, need-info, close-duplicate' },
            reason: { type: 'string', description: 'Why this action is recommended' },
          },
          required: ['action'],
        },
        description: 'Recommended triage actions',
      },
      used_canned_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of canned responses referenced, if any',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the triage approach',
      },
    },
    required: ['response_text', 'suggested_actions', 'reasoning'],
  },

  refine: {
    type: 'object',
    properties: {
      refined_response: {
        type: 'string',
        description: 'The updated response text after applying user instructions',
      },
      changes_made: {
        type: 'array',
        items: { type: 'string' },
        description: 'Brief description of each change made',
      },
    },
    required: ['refined_response', 'changes_made'],
  },

  testpage: {
    type: 'object',
    properties: {
      can_generate: {
        type: 'boolean',
        description: 'True if a meaningful test page can be generated from the bug report',
      },
      html_content: {
        type: 'string',
        description: 'The complete, self-contained HTML test page with inline CSS and JS',
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of what the test page demonstrates or why it cannot be generated',
      },
    },
    required: ['can_generate', 'html_content', 'reason'],
  },
};

/**
 * System context that's common across all prompts.
 */
const SYSTEM_CONTEXT = `You are a Mozilla Firefox bug triager assistant. Your role is to help triage Bugzilla bugs efficiently and professionally.

Guidelines:
- Be conservative in your assessments - only mark things as true if you have clear evidence
- Keep responses professional, helpful, and welcoming to bug reporters
- Focus on actionable information that helps developers and triagers

## Codebase Research Tools

When analyzing bugs, you may need to look up code references, understand affected components, or check historical changes. The following tools are available for searching the Mozilla codebase:

### Searchfox (https://searchfox.org/)
Online code search for Mozilla repositories. Use this to:
- Look up function/class definitions mentioned in bug reports
- Find where specific code paths are implemented
- Understand component structure and dependencies
- Search for related code patterns

### searchfox-cli (https://github.com/padenot/searchfox-cli)
Command-line interface for Searchfox. Useful for:
- Batch searches across the codebase
- Scripted code lookups
- Integration with local workflows

### treeherder-cli (https://github.com/padenot/treeherder-cli)
Command-line tool for traversing Mozilla's CI/CD system and code history. Use this to:
- Check recent code changes related to a component
- Look up test failures and regressions
- Understand the history of changes in affected areas
- Find related commits and patches

When relevant code paths or components are mentioned in a bug, consider using these tools to gather additional context that could help with triage decisions.`;

/**
 * Build the classification prompt for analyzing a bug.
 *
 * @param {Object} bug - Bug object with id, summary, description, comments, attachments
 * @param {Object[]} [cannedResponses] - Optional array of canned responses for suggestion
 * @returns {string} The prompt text
 */
export function buildClassifyPrompt(bug, cannedResponses = []) {
  const bugId = bug.id || 'unknown';
  const summary = bug.summary || 'No summary';
  const description = bug.description || '';
  const status = bug.status || 'Unknown';
  const product = bug.product || 'Unknown';
  const component = bug.component || 'Unknown';

  // Format comments (limit to first 5 for context window efficiency)
  let commentsText = '';
  if (bug.comments && bug.comments.length > 0) {
    const comments = bug.comments.slice(0, 5);
    commentsText = comments
      .map((c, i) => {
        const text = (c.text || c.raw_text || '').substring(0, 2000);
        return `### Comment ${i + 1}\n${text}`;
      })
      .join('\n\n');
  }

  // Format attachments
  let attachmentsText = '';
  if (bug.attachments && bug.attachments.length > 0) {
    attachmentsText = bug.attachments
      .map((att) => `- **${att.filename || 'unnamed'}**: ${att.description || 'No description'}`)
      .join('\n');
  }

  // Format canned responses for suggestion
  let cannedResponsesText = '';
  if (cannedResponses && cannedResponses.length > 0) {
    cannedResponsesText = cannedResponses
      .map((resp) => {
        const id = resp.id || 'unknown';
        const title = resp.title || 'Untitled';
        const desc = resp.description || '';
        const bodyPreview = (resp.bodyTemplate || '').substring(0, 300);
        return `### ${id}
**Title:** ${title}
${desc ? `**Description:** ${desc}` : ''}
**Template Preview:**
${bodyPreview}${bodyPreview.length >= 300 ? '...' : ''}`;
      })
      .join('\n\n');
  }

  return `${SYSTEM_CONTEXT}

## Bug Information

**Bug ID:** ${bugId}
**Summary:** ${summary}
**Status:** ${status}
**Product:** ${product}
**Component:** ${component}

## Description

${description}

${commentsText ? `## Comments\n\n${commentsText}` : ''}

${attachmentsText ? `## Attachments\n\n${attachmentsText}` : ''}

${cannedResponsesText ? `## Available Canned Responses

These are pre-defined response templates you can recommend:

${cannedResponsesText}` : ''}

## Task

Analyze this bug and determine the following:

### 1. ai_detected_str: Steps to Reproduce Detection

Are there CLEAR and SPECIFIC steps to reproduce (STR)?

**Mark TRUE only if:**
- The steps are detailed enough that a developer could reliably reproduce the issue (>70% of the time)
- The steps specify the exact conditions, settings, and actions needed

**Mark FALSE if:**
- Steps are vague or generic (e.g., "play a YouTube video", "browse the web", "use the browser normally")
- The issue is intermittent without specific conditions that trigger it
- Steps depend on specific user environment/settings that aren't documented
- The reporter says they cannot reliably reproduce the issue
- The bug is a general complaint without actionable reproduction steps

**Examples:**
- Good STR: "1. Open about:config, 2. Set media.hardware-video-decoding.enabled to true, 3. Open youtube.com/watch?v=xyz, 4. Observe crash after 5 seconds"
- Bad STR: "Sometimes when watching YouTube videos, the video stops playing"

### 2. ai_detected_test_attached: Test Case Detection

Is there a testcase file, reproduction HTML/JS, or test code clearly referenced or attached?

### 3. crashstack_present: Crash Stack Detection

Is there a crash stack trace, AddressSanitizer (ASan) output, or similar diagnostic output present?

### 4. fuzzing_testcase: Fuzzing Detection

Does this appear to be from fuzzing? Look for mentions of: fuzzilli, oss-fuzz, grizzly, fuzzer, or similar fuzzing tools/frameworks.

### 5. summary: Brief Summary

Write a brief 1-3 sentence summary of what this bug is about, suitable for triagers who need to quickly understand the issue.

### 6. suggested_severity: Severity Assessment

Based on Mozilla's severity definitions, suggest an appropriate severity:
- **S1** - Catastrophic: Blocks development/testing, affects 25%+ of users, causes data loss, no workaround
- **S2** - Serious: Major functionality impaired, high impact, no satisfactory workaround
- **S3** - Normal: Blocks non-critical functionality, a workaround exists
- **S4** - Small/Trivial: Minor significance, cosmetic issues, low or no user impact
- **N/A** - Not Applicable: For Task or Enhancement type bugs
- **--** - Unknown: Not enough information to assess

### 7. suggested_priority: Priority Assessment

Based on Mozilla's priority definitions, suggest an appropriate priority:
- **P1** - Fix in the current release cycle (critical issues)
- **P2** - Fix in the next release cycle or the following
- **P3** - Backlog (lower priority, will be addressed when resources allow)
- **P5** - Will not fix, but will accept a patch (nice-to-have)
- **--** - Unknown: Not enough information to assess

### 8. suggested_actions: Recommended Triage Actions

List specific actions the triager should take. Common actions include:
- **need-info**: Request specific missing information from the reporter
- **need-str**: Request clear steps to reproduce
- **need-profile**: Request performance profile or crash data
- **set-has-str**: Mark the bug as having steps to reproduce
- **set-severity**: Set the severity field
- **set-priority**: Set the priority field
- **assign-component**: Suggest moving to a different component
- **close-duplicate**: Suggest closing as duplicate (if applicable)
- **close-incomplete**: Suggest closing due to incomplete information

For each action, provide a brief reason explaining why it's recommended.

### 9. triage_reasoning: Overall Assessment

Write a brief explanation (2-4 sentences) of your overall triage assessment. This helps triagers understand your reasoning and makes it easier to verify or adjust the recommendations.

### 10. suggested_canned_id: Recommended Response Template

If canned responses are provided above, recommend the most appropriate one for this bug. Consider:
- What information is missing or what action is needed?
- Which template best matches the situation?
- Return an empty string if no canned response is a good fit

### 11. draft_response: Customized Response Draft

If you selected a canned response, draft a customized version tailored for this specific bug:
- Replace placeholders ({{BUG_ID}}, {{VERSION}}, etc.) with appropriate values
- Adapt the language to address the specific issue
- Keep it professional, helpful, and welcoming
- Return an empty string if no canned response was selected

## Output Format

Return ONLY a JSON object with this exact structure:
\`\`\`json
{
  "ai_detected_str": boolean,
  "ai_detected_test_attached": boolean,
  "crashstack_present": boolean,
  "fuzzing_testcase": boolean,
  "summary": "string (1-3 sentences)",
  "suggested_severity": "S1|S2|S3|S4|N/A|--",
  "suggested_priority": "P1|P2|P3|P5|--",
  "suggested_actions": [
    {"action": "string", "reason": "string"},
    ...
  ],
  "triage_reasoning": "string (2-4 sentences)",
  "suggested_canned_id": "string (ID of recommended canned response, or empty string)",
  "draft_response": "string (customized response draft, or empty string)"
}
\`\`\`

**Remember:** Be conservative. For ai_detected_str, err on the side of marking FALSE unless the steps are genuinely actionable and specific. For severity and priority, use "--" if there's not enough information to make a confident assessment.`;
}

/**
 * Build the suggest prompt for recommending canned responses.
 *
 * @param {Object} bug - Bug object
 * @param {Object[]} cannedResponses - Array of available canned responses
 * @returns {string} The prompt text
 */
export function buildSuggestPrompt(bug, cannedResponses) {
  const bugId = bug.id || 'unknown';
  const summary = bug.summary || 'No summary';
  const description = (bug.description || '').substring(0, 1500);

  // Format canned responses for the prompt
  const responsesText = cannedResponses
    .map((resp, i) => {
      const id = resp.id || `response-${i}`;
      const title = resp.title || 'Untitled';
      const desc = resp.description || '';
      const bodyPreview = (resp.bodyTemplate || '').substring(0, 200);
      return `### ${i + 1}. ${id}
**Title:** ${title}
${desc ? `**Description:** ${desc}` : ''}
**Template Preview:** ${bodyPreview}${bodyPreview.length >= 200 ? '...' : ''}`;
    })
    .join('\n\n');

  return `${SYSTEM_CONTEXT}

## Task

Analyze the bug below and recommend the most appropriate canned response from the available options.

## Bug Context

**Bug ID:** ${bugId}
**Summary:** ${summary}

**Description:**
${description}

## Available Canned Responses

${responsesText}

## Instructions

1. Analyze the bug to understand what kind of response would be most helpful
2. Select the most appropriate canned response from the list above
3. Draft a customized version of that response for this specific bug
4. Explain briefly why you chose this response

If no canned response is a good fit, choose the closest match and explain the limitations in your reasoning.

## Output Format

Return ONLY a JSON object with this exact structure:
\`\`\`json
{
  "suggested_response_id": "string (the ID of the chosen canned response)",
  "draft_response": "string (the response customized for this bug)",
  "reasoning": "string (brief explanation of why this response was chosen)"
}
\`\`\``;
}

/**
 * Build the generate prompt for creating triage responses from scratch.
 *
 * @param {Object} bug - Bug object
 * @param {Object} options - Generation options
 * @param {string} [options.mode='response'] - 'response' for comment draft, 'next-steps' for triage actions
 * @param {Object[]} [options.cannedResponses] - Optional canned responses for reference
 * @returns {string} The prompt text
 */
export function buildGeneratePrompt(bug, options = {}) {
  const mode = options.mode || 'response';
  const bugId = bug.id || 'unknown';
  const summary = bug.summary || 'No summary';
  const status = bug.status || 'Unknown';
  const product = bug.product || 'Unknown';
  const component = bug.component || 'Unknown';
  const description = (bug.description || '').substring(0, 2000);

  // Format recent comments
  let commentsText = '';
  if (bug.comments && bug.comments.length > 0) {
    const recentComments = bug.comments.slice(-5);
    commentsText = recentComments
      .map((c, i) => {
        const text = (c.text || c.raw_text || '').substring(0, 1000);
        const idx = bug.comments.length - recentComments.length + i + 1;
        return `### Comment ${idx}\n${text}`;
      })
      .join('\n\n');
  }

  // Format attachments
  let attachmentsText = '';
  if (bug.attachments && bug.attachments.length > 0) {
    attachmentsText = bug.attachments
      .map((att) => `- **${att.filename || 'unnamed'}**: ${att.description || 'No description'}`)
      .join('\n');
  }

  // Format canned responses reference
  let cannedText = '';
  if (options.cannedResponses && options.cannedResponses.length > 0) {
    cannedText = options.cannedResponses
      .map((resp) => {
        const preview = (resp.bodyTemplate || '').substring(0, 150);
        return `- **${resp.id}**: ${resp.title || resp.id}\n  Template: ${preview}${preview.length >= 150 ? '...' : ''}`;
      })
      .join('\n');
  }

  // Mode-specific instructions
  let taskInstructions;
  if (mode === 'next-steps') {
    taskInstructions = `Analyze this bug and recommend the next triage actions.

Consider:
- Does the bug need more information? (STR, profile, testcase, system info)
- Should any flags be set? (Has STR, Need Info)
- Is this potentially a duplicate or known issue?
- What priority/severity seems appropriate based on the description?
- Are there specific components or people who should look at this?`;
  } else {
    taskInstructions = `Draft a polite, professional triage comment for this bug.

The response should:
- Thank the reporter if appropriate (especially for new reporters)
- Be concise and actionable
- Request specific missing information if needed (be specific about what's needed)
- Provide helpful guidance or next steps
- Use a helpful, welcoming tone appropriate for open source community`;
  }

  return `${SYSTEM_CONTEXT}

## Bug Information

**Bug ID:** ${bugId}
**Summary:** ${summary}
**Status:** ${status}
**Product:** ${product}
**Component:** ${component}

## Description

${description}

${bug.aiSummary ? `## AI Summary (from prior analysis)\n\n${bug.aiSummary}` : ''}

${commentsText ? `## Recent Comments\n\n${commentsText}` : ''}

${attachmentsText ? `## Attachments\n\n${attachmentsText}` : ''}

${cannedText ? `## Available Canned Responses (for reference)\n\n${cannedText}` : ''}

## Task

${taskInstructions}

${cannedText ? 'If any of the canned responses above are applicable, you may incorporate their structure or language.' : ''}

## Output Format

Return ONLY a JSON object with this exact structure:
\`\`\`json
{
  "response_text": "string (the triage comment to post)",
  "suggested_actions": [
    { "action": "string (e.g., set-has-str, need-info, close-duplicate)", "reason": "string" }
  ],
  "used_canned_ids": ["string (IDs of canned responses referenced, if any)"],
  "reasoning": "string (brief explanation of your triage approach)"
}
\`\`\``;
}

/**
 * Build the refine prompt for updating a response based on user instructions.
 *
 * @param {Object} bug - Bug object
 * @param {string} currentResponse - The current response text to refine
 * @param {string} userInstruction - The user's instruction for refinement
 * @param {Object} [context={}] - Optional context
 * @param {Object} [context.selectedCannedResponse] - A canned response to incorporate
 * @returns {string} The prompt text
 */
export function buildRefinePrompt(bug, currentResponse, userInstruction, context = {}) {
  const bugId = bug.id || 'unknown';
  const summary = bug.summary || 'No summary';
  const description = (bug.description || '').substring(0, 500);

  let cannedRefText = '';
  if (context.selectedCannedResponse) {
    const resp = context.selectedCannedResponse;
    cannedRefText = `## Reference Canned Response

**ID:** ${resp.id}
**Title:** ${resp.title || 'Untitled'}

**Template:**
${resp.bodyTemplate || ''}`;
  }

  return `${SYSTEM_CONTEXT}

## Task

Refine an existing triage response based on user instructions.

## Bug Context

**Bug ID:** ${bugId}
**Summary:** ${summary}

**Description:**
${description}

## Current Response

\`\`\`
${currentResponse}
\`\`\`

## User Instruction

${userInstruction}

${cannedRefText}

## Instructions

1. Apply the user's instruction to modify the current response
2. Keep the response professional and appropriate for a Mozilla Bugzilla comment
3. Preserve parts of the original that aren't affected by the instruction
4. If a canned response reference is provided, you may incorporate its style or content

## Output Format

Return ONLY a JSON object with this exact structure:
\`\`\`json
{
  "refined_response": "string (the updated response text)",
  "changes_made": ["string (brief description of each change made)"]
}
\`\`\``;
}

/**
 * Build the test page generation prompt.
 *
 * This prompt instructs the AI to create a self-contained HTML test page
 * that reproduces or demonstrates the bug described in the report.
 *
 * @param {Object} bug - Bug object with id, summary, description, comments, attachments
 * @returns {string} The prompt text
 */
export function buildTestPagePrompt(bug) {
  const bugId = bug.id || 'unknown';
  const summary = bug.summary || 'No summary';
  const description = bug.description || '';

  // Format comments (include more for test page generation to capture code snippets)
  let commentsText = '';
  if (bug.comments && bug.comments.length > 0) {
    const comments = bug.comments.slice(0, 10);
    commentsText = comments
      .map((c, i) => {
        const text = (c.text || c.raw_text || '').substring(0, 3000);
        return `### Comment ${i + 1}\n${text}`;
      })
      .join('\n\n');
  }

  // Format attachments info
  let attachmentsText = '';
  if (bug.attachments && bug.attachments.length > 0) {
    attachmentsText = bug.attachments
      .map((att) => `- **${att.filename || 'unnamed'}**: ${att.description || 'No description'}`)
      .join('\n');
  }

  return `You are an elite front-end engineer with deep knowledge of browser rendering, JavaScript, CSS, and Web APIs.

Given a bug report, you must analyze whether a test page can be generated and if so, output a SINGLE, SELF-CONTAINED HTML test page that reproduces or illustrates the bug.

## Bug Information

**Bug ID:** ${bugId}
**Summary:** ${summary}

## Description

${description}

${commentsText ? `## Comments\n\n${commentsText}` : ''}

${attachmentsText ? `## Attachments\n\n${attachmentsText}` : ''}

## Task

1. First, determine if a meaningful test page can be generated from this bug report:
   - Is there code, HTML, CSS, or JavaScript in the bug description or comments?
   - Is the bug about web content behavior that can be demonstrated in a page?
   - Is there enough information to create a reproducible test case?

2. If YES, generate a complete HTML test page following these requirements:
   - Use only vanilla HTML/CSS/JS (no external libraries)
   - Put CSS in <style> and JS in <script> inside the same HTML file
   - Add concise comments explaining what the page is testing and how to trigger the behavior
   - Add any necessary placeholder images/audio/video using data URIs or simple placeholders
   - Include a button to trigger the test and show results on the page
   - Make the page as minimal as possible - no fancy UI or extra features
   - Prioritize clear variable names rather than excessive comments
   - Include the bug ID in the page title for reference

3. If NO, explain why a test page cannot be generated (e.g., browser internals, no code provided, hardware-specific, etc.)

## Output Format

Return ONLY a JSON object with this exact structure:
\`\`\`json
{
  "can_generate": boolean,
  "html_content": "string (complete HTML if can_generate is true, empty string if false)",
  "reason": "string (what the test demonstrates, or why it cannot be generated)"
}
\`\`\`

**Important:** The html_content must be raw HTML without markdown fences. It should start with <!DOCTYPE html> or <html>.`;
}

/**
 * Get the JSON schema for a specific task.
 *
 * @param {string} task - Task name (classify, customize, suggest, generate, refine, testpage)
 * @returns {Object} The JSON schema
 */
export function getSchema(task) {
  return SCHEMAS[task] || null;
}

/**
 * Get the schema as a JSON string (for CLI tools).
 *
 * @param {string} task - Task name
 * @returns {string} JSON string of the schema
 */
export function getSchemaString(task) {
  const schema = SCHEMAS[task];
  return schema ? JSON.stringify(schema) : null;
}

console.log('[prompts] Module loaded');
