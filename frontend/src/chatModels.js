/**
 * Chat Data Models
 *
 * Defines the data structures for the AI chat interface.
 * These models are used throughout the chat system for:
 * - Message storage and display
 * - Session management
 * - Analysis results
 * - WebSocket communication
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * @typedef {'user' | 'assistant' | 'system' | 'permission-request' | 'permission-response'} MessageRole
 */

/**
 * @typedef {'gathering' | 'classification' | 'assessment' | 'investigation' | 'response'} AnalysisPhase
 */

/**
 * @typedef {'file-read' | 'file-write' | 'tool-use' | 'web-search'} PermissionType
 */

/**
 * @typedef {'once' | 'session' | 'denied'} PermissionScope
 */

/**
 * Message metadata for additional context
 * @typedef {Object} MessageMetadata
 * @property {AnalysisPhase} [phase] - Current analysis phase when message was sent
 * @property {PermissionType} [permissionType] - Type of permission requested
 * @property {string} [permissionPath] - File/resource path for permission
 * @property {string} [permissionId] - Unique ID for permission request
 * @property {PermissionScope} [permissionDecision] - User's decision on permission
 * @property {Object} [structuredData] - Structured analysis results (classification, severity, etc.)
 * @property {boolean} [isStreaming] - Whether this message is still being streamed
 * @property {string} [error] - Error message if this represents an error
 */

/**
 * A single chat message
 * @typedef {Object} ChatMessage
 * @property {string} id - Unique message ID
 * @property {MessageRole} role - Who sent the message
 * @property {string} content - Message text content
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {MessageMetadata} [metadata] - Optional metadata
 */

/**
 * Create a new chat message
 * @param {MessageRole} role
 * @param {string} content
 * @param {MessageMetadata} [metadata]
 * @returns {ChatMessage}
 */
export function createMessage(role, content, metadata = {}) {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a user message
 * @param {string} content
 * @returns {ChatMessage}
 */
export function createUserMessage(content) {
  return createMessage('user', content);
}

/**
 * Create an assistant message
 * @param {string} content
 * @param {MessageMetadata} [metadata]
 * @returns {ChatMessage}
 */
export function createAssistantMessage(content, metadata = {}) {
  return createMessage('assistant', content, metadata);
}

/**
 * Create a system message (info, status updates)
 * @param {string} content
 * @param {MessageMetadata} [metadata]
 * @returns {ChatMessage}
 */
export function createSystemMessage(content, metadata = {}) {
  return createMessage('system', content, metadata);
}

/**
 * Create a permission request message
 * @param {string} description - Human-readable description of what's being requested
 * @param {PermissionType} permissionType
 * @param {string} [path] - File/resource path
 * @returns {ChatMessage}
 */
export function createPermissionRequest(description, permissionType, path) {
  return createMessage('permission-request', description, {
    permissionType,
    permissionPath: path,
    permissionId: generateId(),
  });
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * @typedef {'idle' | 'connecting' | 'processing' | 'awaiting-permission' | 'awaiting-input' | 'error' | 'disconnected'} SessionState
 */

/**
 * @typedef {'local' | 'searchfox' | 'none'} CodebaseMode
 */

/**
 * Classification results from AI analysis
 * @typedef {Object} ClassificationResult
 * @property {boolean} hasStr - Has Steps to Reproduce
 * @property {boolean} hasTestcase - Has test case attached or referenced
 * @property {boolean} hasCrashstack - Has crash stack/trace
 * @property {boolean} isFuzzing - Is a fuzzing-related bug
 * @property {string} [strEvidence] - Where STR was found
 * @property {string} [testcaseEvidence] - Where testcase was found
 */

/**
 * Assessment results from AI analysis
 * @typedef {Object} AssessmentResult
 * @property {string} severity - Suggested severity (S1-S4, N/A, --)
 * @property {string} priority - Suggested priority (P1-P5, --)
 * @property {string} reasoning - Explanation for the assessment
 */

/**
 * Code investigation results
 * @typedef {Object} InvestigationResult
 * @property {Array<{path: string, description: string}>} relevantFiles - Files related to the bug
 * @property {Array<{bugId: number, summary: string}>} relatedBugs - Similar/related bugs
 * @property {string} [rootCauseHypothesis] - Potential root cause
 */

/**
 * Full analysis result combining all phases
 * @typedef {Object} AnalysisResult
 * @property {string} summary - Brief bug summary
 * @property {ClassificationResult} classification - Classification results
 * @property {AssessmentResult} assessment - Severity/priority assessment
 * @property {InvestigationResult} [investigation] - Code investigation (if codebase available)
 * @property {string} [draftResponse] - Suggested response to post
 * @property {string} [suggestedResponseId] - ID of recommended canned response
 */

/**
 * Chat session for a single bug
 * @typedef {Object} ChatSession
 * @property {number} bugId - Bugzilla bug ID
 * @property {string} bugSummary - Bug summary for context
 * @property {ChatMessage[]} messages - Message history
 * @property {SessionState} state - Current session state
 * @property {AnalysisPhase} currentPhase - Current analysis phase
 * @property {string} [claudeSessionId] - Claude CLI session ID for resumption
 * @property {AnalysisResult} [analysisResult] - Accumulated analysis results
 * @property {CodebaseMode} codebaseMode - How codebase access is configured
 * @property {string} [codebasePath] - Local codebase path (if mode is 'local')
 * @property {number} createdAt - Session creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {number} [version] - Version for conflict detection
 */

/**
 * Create a new chat session
 * @param {number} bugId
 * @param {string} bugSummary
 * @param {CodebaseMode} [codebaseMode='none']
 * @param {string} [codebasePath]
 * @returns {ChatSession}
 */
export function createSession(bugId, bugSummary, codebaseMode = 'none', codebasePath = null) {
  const now = Date.now();
  return {
    bugId,
    bugSummary,
    messages: [],
    state: 'idle',
    currentPhase: 'gathering',
    claudeSessionId: null,
    analysisResult: null,
    codebaseMode,
    codebasePath,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Add a message to a session (immutable)
 * @param {ChatSession} session
 * @param {ChatMessage} message
 * @returns {ChatSession}
 */
export function addMessageToSession(session, message) {
  return {
    ...session,
    messages: [...session.messages, message],
    updatedAt: Date.now(),
    version: (session.version || 1) + 1,
  };
}

/**
 * Update session state
 * @param {ChatSession} session
 * @param {Partial<ChatSession>} updates
 * @returns {ChatSession}
 */
export function updateSession(session, updates) {
  return {
    ...session,
    ...updates,
    updatedAt: Date.now(),
    version: (session.version || 1) + 1,
  };
}

/**
 * Update the last message in a session (for streaming updates)
 * @param {ChatSession} session
 * @param {string} newContent - New content to replace
 * @param {MessageMetadata} [metadata] - Updated metadata
 * @returns {ChatSession}
 */
export function updateLastMessage(session, newContent, metadata = null) {
  if (session.messages.length === 0) {
    return session;
  }
  const messages = [...session.messages];
  const lastMsg = messages[messages.length - 1];
  messages[messages.length - 1] = {
    ...lastMsg,
    content: newContent,
    ...(metadata ? { metadata: { ...lastMsg.metadata, ...metadata } } : {}),
  };
  return {
    ...session,
    messages,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Analysis Phase Helpers
// ============================================================================

/**
 * All analysis phases in order
 * @type {AnalysisPhase[]}
 */
export const ANALYSIS_PHASES = [
  'gathering',
  'classification',
  'assessment',
  'investigation',
  'response',
];

/**
 * Human-readable phase labels
 * @type {Record<AnalysisPhase, string>}
 */
export const PHASE_LABELS = {
  gathering: 'Gathering Info',
  classification: 'Classifying',
  assessment: 'Assessing',
  investigation: 'Investigating Code',
  response: 'Drafting Response',
};

/**
 * Get the next phase
 * @param {AnalysisPhase} current
 * @returns {AnalysisPhase | null}
 */
export function getNextPhase(current) {
  const idx = ANALYSIS_PHASES.indexOf(current);
  if (idx === -1 || idx >= ANALYSIS_PHASES.length - 1) {
    return null;
  }
  return ANALYSIS_PHASES[idx + 1];
}

/**
 * Get phase completion percentage (0-100)
 * @param {AnalysisPhase} phase
 * @returns {number}
 */
export function getPhaseProgress(phase) {
  const idx = ANALYSIS_PHASES.indexOf(phase);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / ANALYSIS_PHASES.length) * 100);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a unique ID
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a session has an active conversation
 * @param {ChatSession} session
 * @returns {boolean}
 */
export function hasActiveConversation(session) {
  return session.messages.length > 0 || session.claudeSessionId !== null;
}

/**
 * Check if session is in a terminal state
 * @param {ChatSession} session
 * @returns {boolean}
 */
export function isSessionComplete(session) {
  return session.currentPhase === 'response' &&
         session.state === 'idle' &&
         session.analysisResult !== null;
}

/**
 * Get the codebase mode label
 * @param {CodebaseMode} mode
 * @returns {string}
 */
export function getCodebaseModeLabel(mode) {
  switch (mode) {
    case 'local': return 'Local Repository';
    case 'searchfox': return 'Searchfox (Online)';
    case 'none': return 'No Code Access';
    default: return 'Unknown';
  }
}
