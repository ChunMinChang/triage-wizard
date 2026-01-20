/**
 * @fileoverview Export and import functionality module.
 *
 * Responsibilities:
 * - Export bug data as JSON (lossless, with schema version)
 * - Export bug data as CSV (flat table)
 * - Export bug data as Markdown (table format)
 * - Import previously exported JSON
 *
 * @module exports
 */

/** Current export schema version */
export const SCHEMA_VERSION = 1;

/**
 * Export bugs as JSON.
 * Includes: schemaVersion, generatedAt, bugzillaHost, input, ai config, bugs
 * Never includes API keys.
 *
 * @param {Object[]} bugs - Bugs to export
 * @param {Object} metadata - Export metadata (host, input, ai config)
 * @returns {string} JSON string
 */
export function exportJSON(bugs, metadata = {}) {
  // TODO: Build export object per docs/export-formats.md
  console.log('[exports] Exporting JSON:', bugs?.length, 'bugs');
  const exportData = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    bugzillaHost: metadata.bugzillaHost || '',
    input: metadata.input || {},
    ai: {
      provider: metadata.aiProvider || '',
      model: metadata.aiModel || '',
      transport: metadata.aiTransport || '',
    },
    bugs: bugs || [],
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Escape a value for CSV (handle quotes and commas).
 * @param {*} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If the value contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Export bugs as CSV.
 * Columns: bug_id, bug_url, summary_bugzilla, status, product, component,
 *          severity, cf_has_str, has_str_suggested, tags, summary_ai
 *
 * @param {Object[]} bugs - Bugs to export
 * @param {Object} [options] - Export options
 * @param {string} [options.bugzillaHost] - Bugzilla host URL for bug links
 * @returns {string} CSV string
 */
export function exportCSV(bugs, options = {}) {
  if (!bugs || bugs.length === 0) {
    return '';
  }

  const bugzillaHost = options.bugzillaHost || 'https://bugzilla.mozilla.org';

  // Define headers
  const headers = [
    'bug_id',
    'bug_url',
    'summary',
    'status',
    'resolution',
    'product',
    'component',
    'severity',
    'priority',
    'cf_has_str',
    'has_str_suggested',
    'tags',
    'ai_summary',
  ];

  // Build rows
  const rows = bugs.map((bug) => {
    const tagList = (bug.tags || []).map((t) => t.id || t.label).join('; ');

    return [
      bug.id,
      `${bugzillaHost}/show_bug.cgi?id=${bug.id}`,
      bug.summary || '',
      bug.status || '',
      bug.resolution || '',
      bug.product || '',
      bug.component || '',
      bug.severity || '',
      bug.priority || '',
      bug.cfHasStr || '',
      bug.hasStrSuggested ? 'yes' : 'no',
      tagList,
      bug.aiSummary || '',
    ].map(escapeCSV);
  });

  // Combine headers and rows
  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  return csvLines.join('\n');
}

/**
 * Escape a value for Markdown table cells.
 * @param {*} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeMD(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape pipe characters and newlines (replace newlines with <br>)
  return str
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

/**
 * Export bugs as Markdown table.
 * @param {Object[]} bugs - Bugs to export
 * @param {Object} options - Export options
 * @param {string} [options.bugzillaHost] - Bugzilla host URL for bug links
 * @param {boolean} [options.includeAiSummary] - Include AI summary column
 * @returns {string} Markdown string
 */
export function exportMarkdown(bugs, options = {}) {
  if (!bugs || bugs.length === 0) {
    return '# Bug Triage Report\n\nNo bugs to export.\n';
  }

  const bugzillaHost = options.bugzillaHost || 'https://bugzilla.mozilla.org';
  const includeAiSummary = options.includeAiSummary !== false;

  const lines = [];

  // Title
  lines.push('# Bug Triage Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total bugs: ${bugs.length}`);
  lines.push('');

  // Table header
  const headers = ['Bug ID', 'Status', 'Product/Component', 'Summary', 'Tags'];
  if (includeAiSummary) {
    headers.push('AI Summary');
  }
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  // Table rows
  for (const bug of bugs) {
    const bugLink = `[${bug.id}](${bugzillaHost}/show_bug.cgi?id=${bug.id})`;
    const status = bug.resolution ? `${bug.status} (${bug.resolution})` : bug.status || '';
    const productComponent = `${bug.product || ''}/${bug.component || ''}`;
    const summary = escapeMD(bug.summary || '').substring(0, 80);
    const tagList = (bug.tags || []).map((t) => `\`${t.id || t.label}\``).join(' ');

    const row = [bugLink, status, productComponent, summary, tagList];
    if (includeAiSummary) {
      const aiSummary = escapeMD(bug.aiSummary || '').substring(0, 100);
      row.push(aiSummary || '-');
    }

    lines.push('| ' + row.join(' | ') + ' |');
  }

  lines.push('');
  lines.push('---');
  lines.push('*Exported from Bugzilla Bug Triage Helper*');

  return lines.join('\n');
}

/**
 * Import bugs from JSON export.
 * @param {string} jsonString - JSON string to import
 * @returns {Object} { bugs, metadata, errors }
 */
export function importJSON(jsonString) {
  // TODO: Parse, validate schema, return bugs
  console.log('[exports] Importing JSON');
  try {
    const data = JSON.parse(jsonString);
    if (data.schemaVersion !== SCHEMA_VERSION) {
      console.warn('[exports] Schema version mismatch:', data.schemaVersion);
      // TODO: Handle migration
    }
    return {
      bugs: data.bugs || [],
      metadata: {
        bugzillaHost: data.bugzillaHost,
        input: data.input,
        ai: data.ai,
      },
      errors: [],
    };
  } catch (err) {
    return {
      bugs: [],
      metadata: {},
      errors: [err.message],
    };
  }
}

/**
 * Migrate export data from older schema version.
 * @param {Object} data - Export data to migrate
 * @returns {Object} Migrated data
 */
export function migrateSchema(data) {
  // Future: Handle schema migrations
  if (data.schemaVersion === SCHEMA_VERSION) {
    return data;
  }
  console.log('[exports] Migrating from schema version:', data.schemaVersion);
  // TODO: Implement migrations as needed
  return data;
}

/**
 * Download data as a file.
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke the URL to free memory
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename with timestamp.
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension
 * @returns {string} Filename with timestamp
 */
export function generateFilename(prefix, extension) {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}.${extension}`;
}

console.log('[exports] Module loaded');
