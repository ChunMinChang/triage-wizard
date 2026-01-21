/**
 * Chat WebSocket Protocol
 *
 * Defines the message format for communication between frontend and backend.
 * The backend streams Claude CLI output and forwards it to the frontend.
 *
 * Protocol is JSONL (newline-delimited JSON) over WebSocket.
 */

// ============================================================================
// Client → Server Messages
// ============================================================================

/**
 * @typedef {'start' | 'message' | 'permission-response' | 'cancel' | 'ping'} ClientMessageType
 */

/**
 * Start a new chat session for a bug
 * @typedef {Object} StartMessage
 * @property {'start'} type
 * @property {number} bugId - Bugzilla bug ID
 * @property {Object} bugData - Full bug data from Bugzilla API
 * @property {'local' | 'searchfox' | 'none'} codebaseMode - How to access Firefox codebase
 * @property {string} [codebasePath] - Local path (required if mode is 'local')
 * @property {string} [claudeSessionId] - Resume from previous session
 * @property {string} [initialPrompt] - Custom initial prompt (optional, uses default if not provided)
 */

/**
 * Send a user message in ongoing conversation
 * @typedef {Object} UserMessage
 * @property {'message'} type
 * @property {string} content - User's message text
 * @property {number} bugId - Bug ID for context
 */

/**
 * Respond to a permission request
 * @typedef {Object} PermissionResponse
 * @property {'permission-response'} type
 * @property {string} permissionId - ID of the permission request
 * @property {boolean} allow - Whether to allow the action
 * @property {'once' | 'session'} [scope] - Scope of permission (if allowed)
 */

/**
 * Cancel ongoing operation
 * @typedef {Object} CancelMessage
 * @property {'cancel'} type
 * @property {number} bugId - Bug ID of session to cancel
 */

/**
 * Keepalive ping
 * @typedef {Object} PingMessage
 * @property {'ping'} type
 */

/**
 * Union of all client message types
 * @typedef {StartMessage | UserMessage | PermissionResponse | CancelMessage | PingMessage} ClientMessage
 */

// ============================================================================
// Server → Client Messages
// ============================================================================

/**
 * @typedef {'init' | 'chunk' | 'message-complete' | 'phase-change' | 'analysis-update' | 'permission-request' | 'error' | 'session-end' | 'pong'} ServerMessageType
 */

/**
 * Session initialized
 * @typedef {Object} InitMessage
 * @property {'init'} type
 * @property {number} bugId
 * @property {string} claudeSessionId - Claude CLI session ID for future resumption
 * @property {string} model - Model being used
 */

/**
 * Streaming text chunk from Claude
 * @typedef {Object} ChunkMessage
 * @property {'chunk'} type
 * @property {string} content - Text chunk
 * @property {string} [messageId] - ID of the message being built
 */

/**
 * AI message complete
 * @typedef {Object} MessageCompleteMessage
 * @property {'message-complete'} type
 * @property {string} messageId
 * @property {string} fullContent - Full message text
 * @property {Object} [structuredData] - Any structured data extracted
 */

/**
 * Analysis phase changed
 * @typedef {Object} PhaseChangeMessage
 * @property {'phase-change'} type
 * @property {string} phase - New phase: 'gathering' | 'classification' | 'assessment' | 'investigation' | 'response'
 * @property {string} [reason] - Why phase changed
 */

/**
 * Analysis results updated
 * @typedef {Object} AnalysisUpdateMessage
 * @property {'analysis-update'} type
 * @property {Object} data - Partial analysis result to merge
 * @property {string} phase - Which phase produced this update
 */

/**
 * Permission request from Claude
 * @typedef {Object} PermissionRequestMessage
 * @property {'permission-request'} type
 * @property {string} permissionId - Unique ID for this request
 * @property {'file-read' | 'file-write' | 'tool-use' | 'web-search'} permissionType
 * @property {string} [path] - File/resource path
 * @property {string} description - Human-readable description
 */

/**
 * Error occurred
 * @typedef {Object} ErrorMessage
 * @property {'error'} type
 * @property {string} message - Error description
 * @property {string} [code] - Error code
 * @property {boolean} [fatal] - Whether session should be terminated
 */

/**
 * Session ended
 * @typedef {Object} SessionEndMessage
 * @property {'session-end'} type
 * @property {string} claudeSessionId - Session ID for future resumption
 * @property {Object} [finalAnalysis] - Complete analysis result
 * @property {Object} usage - Token usage and cost
 */

/**
 * Keepalive pong
 * @typedef {Object} PongMessage
 * @property {'pong'} type
 */

/**
 * Union of all server message types
 * @typedef {InitMessage | ChunkMessage | MessageCompleteMessage | PhaseChangeMessage | AnalysisUpdateMessage | PermissionRequestMessage | ErrorMessage | SessionEndMessage | PongMessage} ServerMessage
 */

// ============================================================================
// Message Creators (Client → Server)
// ============================================================================

/**
 * Create a start message
 * @param {number} bugId
 * @param {Object} bugData
 * @param {'local' | 'searchfox' | 'none'} codebaseMode
 * @param {string} [codebasePath]
 * @param {string} [claudeSessionId]
 * @returns {StartMessage}
 */
export function createStartMessage(bugId, bugData, codebaseMode, codebasePath = null, claudeSessionId = null) {
  return {
    type: 'start',
    bugId,
    bugData,
    codebaseMode,
    ...(codebasePath && { codebasePath }),
    ...(claudeSessionId && { claudeSessionId }),
  };
}

/**
 * Create a user message
 * @param {number} bugId
 * @param {string} content
 * @returns {UserMessage}
 */
export function createUserMessagePacket(bugId, content) {
  return {
    type: 'message',
    bugId,
    content,
  };
}

/**
 * Create a permission response
 * @param {string} permissionId
 * @param {boolean} allow
 * @param {'once' | 'session'} [scope]
 * @returns {PermissionResponse}
 */
export function createPermissionResponse(permissionId, allow, scope = 'once') {
  return {
    type: 'permission-response',
    permissionId,
    allow,
    ...(allow && { scope }),
  };
}

/**
 * Create a cancel message
 * @param {number} bugId
 * @returns {CancelMessage}
 */
export function createCancelMessage(bugId) {
  return {
    type: 'cancel',
    bugId,
  };
}

/**
 * Create a ping message
 * @returns {PingMessage}
 */
export function createPingMessage() {
  return { type: 'ping' };
}

// ============================================================================
// Message Parsing (Server → Client)
// ============================================================================

/**
 * Parse a server message from JSON
 * @param {string} json - Raw JSON string
 * @returns {ServerMessage | null}
 */
export function parseServerMessage(json) {
  try {
    const msg = JSON.parse(json);
    if (!msg || typeof msg.type !== 'string') {
      console.warn('Invalid server message: missing type', msg);
      return null;
    }
    return msg;
  } catch (e) {
    console.error('Failed to parse server message:', e, json);
    return null;
  }
}

/**
 * Check if message is a text chunk
 * @param {ServerMessage} msg
 * @returns {msg is ChunkMessage}
 */
export function isChunkMessage(msg) {
  return msg.type === 'chunk';
}

/**
 * Check if message is a permission request
 * @param {ServerMessage} msg
 * @returns {msg is PermissionRequestMessage}
 */
export function isPermissionRequest(msg) {
  return msg.type === 'permission-request';
}

/**
 * Check if message is an error
 * @param {ServerMessage} msg
 * @returns {msg is ErrorMessage}
 */
export function isErrorMessage(msg) {
  return msg.type === 'error';
}

/**
 * Check if message indicates session should continue
 * @param {ServerMessage} msg
 * @returns {boolean}
 */
export function isTerminalMessage(msg) {
  return msg.type === 'session-end' ||
         (msg.type === 'error' && msg.fatal);
}

// ============================================================================
// WebSocket Endpoint
// ============================================================================

/**
 * Default WebSocket endpoint path
 */
export const WS_ENDPOINT = '/api/chat/stream';

/**
 * Build WebSocket URL from backend URL
 * @param {string} backendUrl - HTTP backend URL (e.g., 'http://localhost:3000')
 * @returns {string} - WebSocket URL (e.g., 'ws://localhost:3000/api/chat/stream')
 */
export function buildWsUrl(backendUrl) {
  const url = new URL(backendUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = WS_ENDPOINT;
  return url.toString();
}
