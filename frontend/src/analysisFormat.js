/**
 * Analysis Persistence Format
 *
 * Defines the format for saving and loading bug analysis files.
 * Uses YAML frontmatter + Markdown body for human-readability.
 *
 * Format:
 * ---
 * bug_id: 1234567
 * ... YAML metadata ...
 * ---
 * # Bug 1234567 Analysis
 * ... Markdown content ...
 */

import {
  ANALYSIS_PHASES,
  PHASE_LABELS,
  createSession,
  createMessage,
} from './chatModels.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Current format version for compatibility checking
 */
export const FORMAT_VERSION = 1;

/**
 * File extension for analysis files
 */
export const FILE_EXTENSION = '.md';

/**
 * Generate filename for a bug analysis
 * @param {number} bugId
 * @param {string} [suffix] - Optional suffix (e.g., 'investigation')
 * @returns {string}
 */
export function generateFilename(bugId, suffix = null) {
  const parts = [`bug${bugId}-analysis`];
  if (suffix) {
    parts.push(suffix.toLowerCase().replace(/\s+/g, '-'));
  }
  return parts.join('-') + FILE_EXTENSION;
}

// ============================================================================
// Export (Session → Markdown)
// ============================================================================

/**
 * Export a chat session to markdown format
 * @param {import('./chatModels.js').ChatSession} session
 * @param {Object} [options]
 * @param {boolean} [options.includeConversation=true] - Include full chat history
 * @param {boolean} [options.includeTimestamps=false] - Include timestamps in conversation
 * @returns {string} - Markdown string
 */
export function exportToMarkdown(session, options = {}) {
  const { includeConversation = true, includeTimestamps = false } = options;

  const frontmatter = buildFrontmatter(session);
  const body = buildMarkdownBody(session, { includeConversation, includeTimestamps });

  return `---\n${frontmatter}---\n\n${body}`;
}

/**
 * Build YAML frontmatter from session
 * @param {import('./chatModels.js').ChatSession} session
 * @returns {string}
 */
function buildFrontmatter(session) {
  const lines = [];

  // Basic info
  lines.push(`bug_id: ${session.bugId}`);
  lines.push(`bug_summary: "${escapeYamlString(session.bugSummary)}"`);
  lines.push(`analyzed_at: "${new Date(session.updatedAt).toISOString()}"`);
  lines.push(`format_version: ${FORMAT_VERSION}`);

  // Codebase config
  lines.push(`codebase_mode: ${session.codebaseMode}`);
  if (session.codebasePath) {
    lines.push(`codebase_path: "${session.codebasePath}"`);
  }

  // Phase tracking
  lines.push(`current_phase: ${session.currentPhase}`);
  const completedPhases = getCompletedPhases(session.currentPhase);
  lines.push(`phases_completed: [${completedPhases.join(', ')}]`);

  // Claude session for resumption
  if (session.claudeSessionId) {
    lines.push(`claude_session_id: "${session.claudeSessionId}"`);
  }

  // Analysis results
  if (session.analysisResult) {
    const ar = session.analysisResult;

    // Classification
    if (ar.classification) {
      lines.push('classification:');
      lines.push(`  has_str: ${ar.classification.hasStr}`);
      lines.push(`  has_testcase: ${ar.classification.hasTestcase}`);
      lines.push(`  has_crashstack: ${ar.classification.hasCrashstack}`);
      lines.push(`  is_fuzzing: ${ar.classification.isFuzzing}`);
    }

    // Assessment
    if (ar.assessment) {
      lines.push(`severity: ${ar.assessment.severity || '--'}`);
      lines.push(`priority: ${ar.assessment.priority || '--'}`);
    }

    // Suggested response
    if (ar.suggestedResponseId) {
      lines.push(`suggested_response_id: ${ar.suggestedResponseId}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Build markdown body from session
 * @param {import('./chatModels.js').ChatSession} session
 * @param {Object} options
 * @returns {string}
 */
function buildMarkdownBody(session, options) {
  const sections = [];

  // Title
  sections.push(`# Bug ${session.bugId} Analysis\n`);
  sections.push(`> ${session.bugSummary}\n`);

  // Summary
  if (session.analysisResult?.summary) {
    sections.push('## Summary\n');
    sections.push(session.analysisResult.summary + '\n');
  }

  // Classification
  if (session.analysisResult?.classification) {
    sections.push('## Classification\n');
    const c = session.analysisResult.classification;
    sections.push(`- **Steps to Reproduce**: ${c.hasStr ? 'Yes' : 'No'}${c.strEvidence ? ` (${c.strEvidence})` : ''}`);
    sections.push(`- **Test Case**: ${c.hasTestcase ? 'Yes' : 'No'}${c.testcaseEvidence ? ` (${c.testcaseEvidence})` : ''}`);
    sections.push(`- **Crash Stack**: ${c.hasCrashstack ? 'Yes' : 'No'}`);
    sections.push(`- **Fuzzing Bug**: ${c.isFuzzing ? 'Yes' : 'No'}\n`);
  }

  // Assessment
  if (session.analysisResult?.assessment) {
    sections.push('## Assessment\n');
    const a = session.analysisResult.assessment;
    sections.push(`- **Suggested Severity**: ${a.severity || '--'}`);
    sections.push(`- **Suggested Priority**: ${a.priority || '--'}`);
    if (a.reasoning) {
      sections.push(`\n**Reasoning**: ${a.reasoning}\n`);
    }
  }

  // Code Investigation
  if (session.analysisResult?.investigation) {
    sections.push('## Code Investigation\n');
    const inv = session.analysisResult.investigation;

    if (inv.relevantFiles?.length > 0) {
      sections.push('### Relevant Files\n');
      for (const f of inv.relevantFiles) {
        sections.push(`- \`${f.path}\` - ${f.description}`);
      }
      sections.push('');
    }

    if (inv.relatedBugs?.length > 0) {
      sections.push('### Related Bugs\n');
      for (const b of inv.relatedBugs) {
        sections.push(`- Bug ${b.bugId} - ${b.summary}`);
      }
      sections.push('');
    }

    if (inv.rootCauseHypothesis) {
      sections.push('### Root Cause Hypothesis\n');
      sections.push(inv.rootCauseHypothesis + '\n');
    }
  }

  // Draft Response
  if (session.analysisResult?.draftResponse) {
    sections.push('## Recommended Response\n');
    sections.push('```');
    sections.push(session.analysisResult.draftResponse);
    sections.push('```\n');
  }

  // Conversation Log (optional)
  if (options.includeConversation && session.messages.length > 0) {
    sections.push('---\n');
    sections.push('## Conversation Log\n');
    sections.push('<details>\n<summary>Show full conversation</summary>\n');

    for (const msg of session.messages) {
      const roleLabel = getRoleLabel(msg.role);
      const timestamp = options.includeTimestamps
        ? ` (${new Date(msg.timestamp).toLocaleString()})`
        : '';

      sections.push(`**${roleLabel}**${timestamp}:\n`);

      // Format content based on role
      if (msg.role === 'permission-request') {
        sections.push(`> Permission requested: ${msg.metadata?.permissionType} - ${msg.content}\n`);
      } else if (msg.role === 'permission-response') {
        sections.push(`> ${msg.content}\n`);
      } else {
        sections.push(msg.content + '\n');
      }
    }

    sections.push('</details>\n');
  }

  return sections.join('\n');
}

// ============================================================================
// Import (Markdown → Session)
// ============================================================================

/**
 * Parse a markdown file into a session object
 * @param {string} markdown - Full markdown content
 * @returns {{ session: import('./chatModels.js').ChatSession, warnings: string[] }}
 */
export function importFromMarkdown(markdown) {
  const warnings = [];

  // Split frontmatter and body
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid format: missing YAML frontmatter');
  }

  const [, frontmatterStr, body] = match;

  // Parse frontmatter
  const frontmatter = parseYamlFrontmatter(frontmatterStr);

  // Validate required fields
  if (!frontmatter.bug_id) {
    throw new Error('Invalid format: missing bug_id in frontmatter');
  }

  // Check version compatibility
  if (frontmatter.format_version && frontmatter.format_version > FORMAT_VERSION) {
    warnings.push(`File was created with newer format version ${frontmatter.format_version}. Some features may not load correctly.`);
  }

  // Create session
  const session = createSession(
    frontmatter.bug_id,
    frontmatter.bug_summary || `Bug ${frontmatter.bug_id}`,
    frontmatter.codebase_mode || 'none',
    frontmatter.codebase_path || null
  );

  // Restore metadata
  session.currentPhase = frontmatter.current_phase || 'gathering';
  session.claudeSessionId = frontmatter.claude_session_id || null;

  if (frontmatter.analyzed_at) {
    session.updatedAt = new Date(frontmatter.analyzed_at).getTime();
  }

  // Restore analysis results
  if (frontmatter.classification || frontmatter.severity || frontmatter.priority) {
    session.analysisResult = {
      summary: extractSummaryFromBody(body),
      classification: frontmatter.classification ? {
        hasStr: frontmatter.classification.has_str || false,
        hasTestcase: frontmatter.classification.has_testcase || false,
        hasCrashstack: frontmatter.classification.has_crashstack || false,
        isFuzzing: frontmatter.classification.is_fuzzing || false,
      } : null,
      assessment: {
        severity: frontmatter.severity || '--',
        priority: frontmatter.priority || '--',
        reasoning: extractReasoningFromBody(body),
      },
      investigation: extractInvestigationFromBody(body),
      draftResponse: extractDraftResponseFromBody(body),
      suggestedResponseId: frontmatter.suggested_response_id || null,
    };
  }

  // Try to extract conversation from body
  const messages = extractConversationFromBody(body);
  if (messages.length > 0) {
    session.messages = messages;
  }

  return { session, warnings };
}

// ============================================================================
// YAML Helpers
// ============================================================================

/**
 * Simple YAML frontmatter parser (handles basic key-value pairs)
 * @param {string} yaml
 * @returns {Object}
 */
function parseYamlFrontmatter(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  let currentKey = null;
  let currentIndent = 0;
  let currentObject = result;
  const objectStack = [result];

  for (const line of lines) {
    if (!line.trim()) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    // Handle nested objects
    if (indent > currentIndent && currentKey) {
      currentObject[currentKey] = {};
      objectStack.push(currentObject);
      currentObject = currentObject[currentKey];
    } else if (indent < currentIndent && objectStack.length > 1) {
      currentObject = objectStack.pop();
    }

    const match = content.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      currentKey = key;
      currentIndent = indent;

      if (value) {
        currentObject[key] = parseYamlValue(value);
      }
    }
  }

  return result;
}

/**
 * Parse a YAML value
 * @param {string} value
 * @returns {*}
 */
function parseYamlValue(value) {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Array
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(s => s.trim());
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

  return value;
}

/**
 * Escape a string for YAML
 * @param {string} str
 * @returns {string}
 */
function escapeYamlString(str) {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ============================================================================
// Markdown Body Extraction Helpers
// ============================================================================

/**
 * Extract summary section from markdown body
 * @param {string} body
 * @returns {string | null}
 */
function extractSummaryFromBody(body) {
  const match = body.match(/## Summary\s*\n([\s\S]*?)(?=\n##|$)/);
  return match ? match[1].trim() : null;
}

/**
 * Extract reasoning from assessment section
 * @param {string} body
 * @returns {string | null}
 */
function extractReasoningFromBody(body) {
  const match = body.match(/\*\*Reasoning\*\*:\s*([\s\S]*?)(?=\n##|$)/);
  return match ? match[1].trim() : null;
}

/**
 * Extract investigation results from body
 * @param {string} body
 * @returns {Object | null}
 */
function extractInvestigationFromBody(body) {
  const section = body.match(/## Code Investigation\s*\n([\s\S]*?)(?=\n---|\n## |$)/);
  if (!section) return null;

  const content = section[1];
  const result = {};

  // Extract relevant files
  const filesMatch = content.match(/### Relevant Files\s*\n([\s\S]*?)(?=\n###|$)/);
  if (filesMatch) {
    result.relevantFiles = [];
    const fileLines = filesMatch[1].match(/- `([^`]+)` - (.+)/g) || [];
    for (const line of fileLines) {
      const m = line.match(/- `([^`]+)` - (.+)/);
      if (m) {
        result.relevantFiles.push({ path: m[1], description: m[2] });
      }
    }
  }

  // Extract related bugs
  const bugsMatch = content.match(/### Related Bugs\s*\n([\s\S]*?)(?=\n###|$)/);
  if (bugsMatch) {
    result.relatedBugs = [];
    const bugLines = bugsMatch[1].match(/- Bug (\d+) - (.+)/g) || [];
    for (const line of bugLines) {
      const m = line.match(/- Bug (\d+) - (.+)/);
      if (m) {
        result.relatedBugs.push({ bugId: parseInt(m[1], 10), summary: m[2] });
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract draft response from body
 * @param {string} body
 * @returns {string | null}
 */
function extractDraftResponseFromBody(body) {
  const match = body.match(/## Recommended Response\s*\n```\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

/**
 * Extract conversation log from body
 * @param {string} body
 * @returns {import('./chatModels.js').ChatMessage[]}
 */
function extractConversationFromBody(body) {
  const section = body.match(/## Conversation Log\s*\n<details>[\s\S]*?<summary>[\s\S]*?<\/summary>\s*\n([\s\S]*?)<\/details>/);
  if (!section) return [];

  const messages = [];
  const content = section[1];

  // Split by role markers
  const parts = content.split(/\*\*(\w+)\*\*(?:\s*\([^)]+\))?:\s*\n/);

  for (let i = 1; i < parts.length; i += 2) {
    const roleLabel = parts[i];
    const messageContent = parts[i + 1]?.trim();

    if (messageContent) {
      const role = labelToRole(roleLabel);
      messages.push(createMessage(role, messageContent));
    }
  }

  return messages;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get completed phases up to and including current phase
 * @param {string} currentPhase
 * @returns {string[]}
 */
function getCompletedPhases(currentPhase) {
  const idx = ANALYSIS_PHASES.indexOf(currentPhase);
  if (idx === -1) return [];
  return ANALYSIS_PHASES.slice(0, idx + 1);
}

/**
 * Get human-readable label for role
 * @param {string} role
 * @returns {string}
 */
function getRoleLabel(role) {
  switch (role) {
    case 'user': return 'User';
    case 'assistant': return 'AI';
    case 'system': return 'System';
    case 'permission-request': return 'Permission Request';
    case 'permission-response': return 'Permission Response';
    default: return role;
  }
}

/**
 * Convert label back to role
 * @param {string} label
 * @returns {string}
 */
function labelToRole(label) {
  switch (label.toLowerCase()) {
    case 'user': return 'user';
    case 'ai': return 'assistant';
    case 'system': return 'system';
    case 'permission request': return 'permission-request';
    case 'permission response': return 'permission-response';
    default: return 'system';
  }
}
