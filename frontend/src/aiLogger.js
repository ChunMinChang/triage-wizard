/**
 * @fileoverview AI interaction logger module.
 *
 * Responsibilities:
 * - Store all AI requests and responses for debugging
 * - Provide access to logs for viewing and export
 * - Persist logs in sessionStorage (cleared on tab close)
 *
 * @module aiLogger
 */

/** Storage key for AI logs */
const STORAGE_KEY = 'ai_interaction_logs';

/** Maximum number of log entries to keep */
const MAX_LOG_ENTRIES = 100;

/** @type {Array<Object>} In-memory log storage */
let logs = [];

/**
 * Log entry structure.
 * @typedef {Object} LogEntry
 * @property {string} id - Unique log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} task - AI task type (classify, customize, suggest, generate, refine)
 * @property {string} provider - AI provider used
 * @property {string} transport - Transport mode (browser/backend)
 * @property {string} model - Model used
 * @property {Object} request - Request data sent to AI
 * @property {Object|null} response - Response received from AI
 * @property {string|null} error - Error message if failed
 * @property {number} durationMs - Time taken in milliseconds
 * @property {Object} metadata - Additional metadata (bug ID, etc.)
 */

/**
 * Initialize logger - load from sessionStorage if available.
 */
export function init() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      logs = JSON.parse(stored);
      console.log(`[aiLogger] Loaded ${logs.length} log entries from session`);
    }
  } catch (err) {
    console.warn('[aiLogger] Failed to load logs from session:', err);
    logs = [];
  }
}

/**
 * Generate a unique ID for log entries.
 * @returns {string} Unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save logs to sessionStorage.
 */
function persistLogs() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn('[aiLogger] Failed to persist logs:', err);
  }
}

/**
 * Start a new log entry (called before AI request).
 * @param {string} task - AI task type
 * @param {Object} request - Request data
 * @param {Object} config - AI config (provider, transport, model)
 * @param {Object} [metadata] - Additional metadata
 * @returns {string} Log entry ID for later completion
 */
export function startEntry(task, request, config, metadata = {}) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    task,
    provider: config.provider || 'unknown',
    transport: config.transport || 'unknown',
    model: config.model || 'default',
    request: sanitizeRequest(request),
    response: null,
    error: null,
    durationMs: 0,
    metadata,
    _startTime: Date.now(),
  };

  logs.push(entry);

  // Trim logs if exceeding max
  if (logs.length > MAX_LOG_ENTRIES) {
    logs = logs.slice(-MAX_LOG_ENTRIES);
  }

  persistLogs();
  return entry.id;
}

/**
 * Complete a log entry with response (called after AI response).
 * @param {string} entryId - Log entry ID from startEntry
 * @param {Object} response - Response data from AI
 */
export function completeEntry(entryId, response) {
  const entry = logs.find((e) => e.id === entryId);
  if (!entry) {
    console.warn('[aiLogger] Entry not found:', entryId);
    return;
  }

  entry.response = response;
  entry.durationMs = Date.now() - entry._startTime;
  delete entry._startTime;

  persistLogs();
  console.log(`[aiLogger] Completed ${entry.task} in ${entry.durationMs}ms`);
}

/**
 * Mark a log entry as failed (called on AI error).
 * @param {string} entryId - Log entry ID from startEntry
 * @param {string|Error} error - Error message or Error object
 */
export function failEntry(entryId, error) {
  const entry = logs.find((e) => e.id === entryId);
  if (!entry) {
    console.warn('[aiLogger] Entry not found:', entryId);
    return;
  }

  entry.error = error instanceof Error ? error.message : String(error);
  entry.durationMs = Date.now() - entry._startTime;
  delete entry._startTime;

  persistLogs();
  console.log(`[aiLogger] Failed ${entry.task} after ${entry.durationMs}ms: ${entry.error}`);
}

/**
 * Sanitize request data to remove sensitive info and reduce size.
 * @param {Object} request - Raw request data
 * @returns {Object} Sanitized request
 */
function sanitizeRequest(request) {
  if (!request) return null;

  const sanitized = { ...request };

  // Don't log full API keys
  if (sanitized.apiKey) {
    sanitized.apiKey = '[REDACTED]';
  }

  // Truncate very long prompts but keep essential info
  if (sanitized.prompt && sanitized.prompt.length > 10000) {
    sanitized.prompt = sanitized.prompt.substring(0, 10000) + '\n... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Get all log entries.
 * @returns {Array<LogEntry>} All log entries (newest first)
 */
export function getAll() {
  return [...logs].reverse();
}

/**
 * Get log entries for a specific task type.
 * @param {string} task - Task type to filter by
 * @returns {Array<LogEntry>} Filtered log entries
 */
export function getByTask(task) {
  return logs.filter((e) => e.task === task).reverse();
}

/**
 * Get log entries for a specific bug.
 * @param {string|number} bugId - Bug ID to filter by
 * @returns {Array<LogEntry>} Filtered log entries
 */
export function getByBugId(bugId) {
  const id = String(bugId);
  return logs.filter((e) => e.metadata?.bugId === id).reverse();
}

/**
 * Get the count of log entries.
 * @returns {number} Number of log entries
 */
export function getCount() {
  return logs.length;
}

/**
 * Get summary statistics.
 * @returns {Object} Summary stats
 */
export function getStats() {
  const stats = {
    total: logs.length,
    successful: 0,
    failed: 0,
    byTask: {},
    byProvider: {},
    avgDurationMs: 0,
  };

  let totalDuration = 0;

  for (const entry of logs) {
    if (entry.error) {
      stats.failed++;
    } else if (entry.response) {
      stats.successful++;
    }

    stats.byTask[entry.task] = (stats.byTask[entry.task] || 0) + 1;
    stats.byProvider[entry.provider] = (stats.byProvider[entry.provider] || 0) + 1;
    totalDuration += entry.durationMs || 0;
  }

  stats.avgDurationMs = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;

  return stats;
}

/**
 * Clear all logs.
 */
export function clear() {
  logs = [];
  persistLogs();
  console.log('[aiLogger] Logs cleared');
}

/**
 * Export logs as JSON string.
 * @returns {string} JSON string of all logs
 */
export function exportAsJson() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    stats: getStats(),
    entries: logs,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Download logs as a JSON file.
 */
export function downloadLogs() {
  const json = exportAsJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `ai-logs-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[aiLogger] Downloaded logs as ${filename}`);
}

// Initialize on module load
init();

console.log('[aiLogger] Module loaded');
