/**
 * Research Dashboard State Primitives
 * Why: Centralize shared constants, mutable state containers, and DOM element references.
 * What: Defines telemetry, prompt, and GitHub state objects alongside the element capture helper.
 * How: Exposes plain objects that other research modules mutate as the dashboard receives events.
 */
const MAX_THOUGHTS = 7;
const MAX_RECENT_REPORTS = 10;
const MAX_SUGGESTIONS = 6;
const MAX_GITHUB_ACTIVITY = 20;
const FALLBACK_SUMMARY = 'No research has completed yet. Launch a mission from the terminal to populate this dashboard.';

const telemetryState = {
  connection: { connected: false, reason: 'Not connected' },
  stage: 'Idle',
  message: 'Waiting for telemetry…',
  detail: null,
  progress: {
    percent: 0,
    completed: 0,
    total: 0,
    depth: null,
    breadth: null
  },
  thoughts: [],
  memory: {
    stats: null,
    records: [],
    uniqueLayers: new Set(),
    uniqueTags: new Set()
  },
  reports: [],
  completedRuns: 0,
  latestSummary: FALLBACK_SUMMARY,
  latestFilename: null,
  suggestions: {
    source: 'memory',
    generatedAt: null,
    items: []
  }
};

const promptState = {
  items: [],
  loading: false,
  error: null,
  searchTerm: '',
  limit: 60,
  debounceId: null
};

const githubState = {
  verifying: false,
  verified: false,
  error: null,
  repo: null,
  branch: null,
  basePath: null,
  currentPath: '',
  entries: [],
  selected: null,
  editorActive: false,
  pendingSave: false,
  loadingDirectory: false,
  loadingMessage: 'Loading…',
  audit: [],
  seenActivityIds: new Set()
};

const els = {};

function captureElements() {
  Object.assign(els, {
    connection: document.getElementById('telemetry-connection'),
    stage: document.getElementById('telemetry-stage'),
    message: document.getElementById('telemetry-message'),
    detail: document.getElementById('telemetry-detail'),
    progressFill: document.getElementById('telemetry-progress-fill'),
    progressPercent: document.getElementById('telemetry-progress-percent'),
    progressCount: document.getElementById('telemetry-progress-count'),
    depth: document.getElementById('telemetry-depth'),
    breadth: document.getElementById('telemetry-breadth'),
    thoughts: document.getElementById('telemetry-thoughts'),
    memorySummary: document.getElementById('telemetry-memory-summary'),
    memoryList: document.getElementById('telemetry-memory-records'),
    suggestionsMeta: document.getElementById('telemetry-suggestions-meta'),
    suggestionsList: document.getElementById('telemetry-suggestions-list'),
    promptList: document.getElementById('prompt-selector-list'),
    promptSearch: document.getElementById('prompt-search-input'),
    promptRefreshBtn: document.getElementById('prompt-refresh-btn'),
    promptStatus: document.getElementById('prompt-status'),
    promptLibraryLink: document.getElementById('prompt-library-link'),
    summaryText: document.getElementById('telemetry-summary-text'),
    summaryMeta: document.getElementById('telemetry-summary-meta'),
    summaryFilename: document.getElementById('telemetry-summary-filename'),
    statsDocs: document.getElementById('stat-docs'),
    statsCategories: document.getElementById('stat-categories'),
    statsTags: document.getElementById('stat-tags'),
    recentReports: document.getElementById('recent-report-feed'),
    githubTree: document.getElementById('research-tree-all'),
    githubCategory: document.getElementById('research-tree-category'),
    githubTags: document.getElementById('research-tree-tags'),
    githubStatus: document.getElementById('github-sync-status'),
    githubPath: document.getElementById('github-path'),
    githubActivity: document.getElementById('github-activity-log'),
    githubRefresh: document.getElementById('github-refresh'),
    githubRoot: document.getElementById('github-root'),
    documentViewer: document.getElementById('document-viewer'),
    documentTitle: document.getElementById('markdown-title'),
    documentCategories: document.getElementById('document-categories'),
    documentTags: document.getElementById('document-tags'),
    documentContent: document.getElementById('markdown-content'),
    documentEdit: document.getElementById('document-edit'),
    documentSave: document.getElementById('document-save'),
    documentClose: document.getElementById('document-close')
  });
}
