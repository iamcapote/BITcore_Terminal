import { GitHubSyncError } from './api.js';

const LEVEL_CLASS = {
  error: 'activity-entry--error',
  warn: 'activity-entry--warn',
  info: 'activity-entry--info',
  debug: 'activity-entry--debug'
};

const DEFAULT_SNAPSHOT_LIMIT = 80;

function formatTimestamp(value) {
  if (!value) return '—';
  const target = typeof value === 'number' ? new Date(value) : new Date(Number(value) || String(value));
  if (Number.isNaN(target.getTime())) {
    return String(value);
  }
  return `${target.toLocaleDateString()} ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function normalizeEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id || `${entry.timestamp}-${entry.sequence}`,
    sequence: entry.sequence ?? 0,
    timestamp: entry.timestamp ?? Date.now(),
    level: entry.level || 'info',
    message: entry.message || '',
    meta: entry.meta || null
  };
}

export class ActivityFeedController {
  constructor({
    root,
    api,
    webcomm,
    snapshotLimit = DEFAULT_SNAPSHOT_LIMIT,
    logger = console
  } = {}) {
    if (!root) {
      throw new Error('ActivityFeedController requires a root element.');
    }
    this.root = root;
    this.api = api;
    this.webcomm = webcomm;
    this.snapshotLimit = snapshotLimit;
    this.logger = logger ?? console;

    this.entries = new Map();
    this.filteredEntries = [];
    this.levelFilter = new Set();
    this.searchTerm = '';
    this.webcommDisposers = [];
    this.connected = false;
    this.lastStats = null;

    this.listElement = root.querySelector('[data-activity-list]');
    this.statusElement = root.querySelector('[data-activity-status]');
    this.statsElement = root.querySelector('[data-activity-stats]');
    this.refreshButton = root.querySelector('[data-activity-action="refresh"]');
    this.exportButton = root.querySelector('[data-activity-action="export"]');
    this.filterForm = root.querySelector('[data-activity-filters]');
    this.searchInput = root.querySelector('input[data-activity-search]');
  }

  init() {
    this.bindControls();
    this.bootstrap();
  }

  destroy() {
    this.webcommDisposers.forEach((dispose) => {
      try { dispose?.(); } catch (error) { this.logger?.warn?.('[ActivityFeed] dispose failed', error); }
    });
    this.webcommDisposers = [];
  }

  bindControls() {
    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => this.refreshSnapshot());
    }
    if (this.exportButton) {
      this.exportButton.addEventListener('click', () => this.exportSnapshot());
    }
    if (this.filterForm) {
      this.filterForm.addEventListener('change', (event) => {
        const target = event.target;
        if (target.matches('input[type="checkbox"][data-activity-level]')) {
          this.toggleLevelFilter(target.value, target.checked);
        }
        if (target.matches('select[data-activity-sample]')) {
          this.refreshSnapshot();
        }
      });
    }
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (event) => {
        this.searchTerm = event.target.value.trim();
        this.applyFilters();
      });
    }
  }

  async bootstrap() {
    await Promise.allSettled([
      this.refreshSnapshot(),
      this.refreshStats()
    ]);
    this.attachWebComm();
  }

  async refreshSnapshot() {
    try {
      const sampleControl = this.filterForm?.querySelector('select[data-activity-sample]');
      const sample = sampleControl ? Number(sampleControl.value) || 1 : 1;
      const params = {
        limit: this.snapshotLimit,
        sample,
        search: this.searchTerm || undefined,
        levels: this.levelFilter.size ? Array.from(this.levelFilter.values()) : undefined
      };
      const response = await this.api.fetchActivitySnapshot(params);
      const entries = Array.isArray(response.data) ? response.data : response;
      this.ingestSnapshot(entries);
      this.updateConnectionStatus({ connected: this.connected, hint: 'HTTP snapshot' });
    } catch (error) {
      this.logger?.warn?.('[ActivityFeed] Snapshot refresh failed', error);
      this.updateConnectionStatus({ connected: this.connected, error: error.message });
      this.renderError(error instanceof GitHubSyncError ? error.message : 'Failed to load snapshot.');
    }
  }

  async refreshStats() {
    try {
      const stats = await this.api.fetchActivityStats();
      this.lastStats = stats?.data ?? stats;
      this.renderStats();
    } catch (error) {
      this.logger?.warn?.('[ActivityFeed] Stats refresh failed', error);
    }
  }

  attachWebComm() {
    if (!this.webcomm || typeof this.webcomm.registerHandler !== 'function') {
      this.updateConnectionStatus({ connected: false, hint: 'WebSocket unavailable' });
      return;
    }

    this.webcommDisposers.push(this.webcomm.registerHandler('connection', (message) => {
      const connected = Boolean(message?.connected);
      this.connected = connected;
      if (connected) {
        this.updateConnectionStatus({ connected: true, hint: 'WebSocket connected' });
        this.requestSnapshotOverSocket();
        this.requestStatsOverSocket();
      } else {
        this.updateConnectionStatus({ connected: false, reason: message?.reason });
      }
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:snapshot', (message) => {
      const payload = message?.data ?? message?.payload;
      if (!payload) return;
      this.ingestSnapshot(payload.entries || []);
      if (payload.meta) {
        this.lastStats = { ...this.lastStats, total: payload.meta.count ?? payload.entries?.length ?? 0 };
        this.renderStats();
      }
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:event', (message) => {
      const entry = normalizeEntry(message?.data?.entry ?? message?.payload?.entry ?? message?.entry);
      if (!entry) return;
      this.addEntry(entry);
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:stats', (message) => {
      const payload = message?.data ?? message?.payload;
      if (!payload) return;
      this.lastStats = payload.stats || payload;
      this.renderStats();
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:export-ready', (message) => {
      const payload = message?.data ?? message?.payload;
      if (!payload) return;
      this.downloadEntries(payload.entries || [], 'github-activity-export.json');
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:error', (message) => {
      const payload = message?.data ?? message?.payload;
      if (payload?.error) {
        this.renderError(payload.error);
      }
    }));

    this.webcommDisposers.push(this.webcomm.registerHandler('github-activity:replay', (message) => {
      const payload = message?.data ?? message?.payload;
      if (!payload || !Array.isArray(payload.entries)) return;
      payload.entries.forEach((entry) => this.addEntry(normalizeEntry(entry)));
    }));

    if (typeof this.webcomm.isConnected === 'function' && this.webcomm.isConnected()) {
      this.connected = true;
      this.updateConnectionStatus({ connected: true, hint: 'WebSocket connected' });
      this.requestSnapshotOverSocket();
      this.requestStatsOverSocket();
    }
  }

  requestSnapshotOverSocket() {
    try {
      const levels = this.levelFilter.size ? Array.from(this.levelFilter.values()) : undefined;
      this.webcomm.send(JSON.stringify({
        type: 'github-activity:command',
        command: 'snapshot',
        limit: this.snapshotLimit,
        levels,
        search: this.searchTerm || undefined
      }));
    } catch (error) {
      this.logger?.warn?.('[ActivityFeed] Failed to request snapshot over socket', error);
    }
  }

  requestStatsOverSocket() {
    try {
      this.webcomm.send(JSON.stringify({
        type: 'github-activity:command',
        command: 'stats'
      }));
    } catch (error) {
      this.logger?.warn?.('[ActivityFeed] Failed to request stats over socket', error);
    }
  }

  ingestSnapshot(entries) {
    this.entries.clear();
    entries.forEach((raw) => {
      const entry = normalizeEntry(raw);
      if (entry) {
        this.entries.set(entry.id, entry);
      }
    });
    this.trimEntries();
    this.applyFilters();
  }

  addEntry(rawEntry) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) return;
    this.entries.set(entry.id, entry);
    this.trimEntries();
    this.applyFilters();
  }

  trimEntries() {
    if (this.entries.size <= this.snapshotLimit) {
      return;
    }
    const sorted = Array.from(this.entries.values()).sort((a, b) => {
      const aTime = a.timestamp ?? 0;
      const bTime = b.timestamp ?? 0;
      return aTime - bTime;
    });
    const toRemove = sorted.length - this.snapshotLimit;
    for (let index = 0; index < toRemove; index += 1) {
      this.entries.delete(sorted[index].id);
    }
  }

  toggleLevelFilter(level, enabled) {
    const normalized = String(level || '').toLowerCase();
    if (!normalized) return;
    if (enabled) {
      this.levelFilter.add(normalized);
    } else {
      this.levelFilter.delete(normalized);
    }
    this.applyFilters();
    if (this.connected) {
      this.requestSnapshotOverSocket();
    }
  }

  applyFilters() {
    const entries = Array.from(this.entries.values()).sort((a, b) => b.timestamp - a.timestamp);
    const hasLevelFilter = this.levelFilter.size > 0;
    const searchTerm = this.searchTerm.toLowerCase();
    this.filteredEntries = entries.filter((entry) => {
      if (hasLevelFilter && !this.levelFilter.has(entry.level)) {
        return false;
      }
      if (searchTerm && !entry.message.toLowerCase().includes(searchTerm)) {
        return false;
      }
      return true;
    });
    this.renderEntries();
  }

  renderEntries() {
    if (!this.listElement) {
      return;
    }
    this.listElement.innerHTML = '';
    if (this.filteredEntries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'activity-entry activity-entry--empty';
      empty.textContent = 'No activity yet. Try running verify or push actions.';
      this.listElement.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    this.filteredEntries.forEach((entry) => {
      const item = document.createElement('li');
      item.className = `activity-entry ${LEVEL_CLASS[entry.level] || ''}`.trim();

      const header = document.createElement('div');
      header.className = 'activity-entry__meta';
      header.innerHTML = `<span class="activity-entry__level" aria-label="${entry.level}">${entry.level.toUpperCase()}</span>` +
        `<time datetime="${new Date(entry.timestamp).toISOString()}">${formatTimestamp(entry.timestamp)}</time>`;

      const message = document.createElement('p');
      message.className = 'activity-entry__message';
      message.textContent = entry.message;

      item.appendChild(header);
      item.appendChild(message);

      if (entry.meta && Object.keys(entry.meta).length) {
        const details = document.createElement('details');
        details.className = 'activity-entry__details';
        const summary = document.createElement('summary');
        summary.textContent = 'Context';
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(entry.meta, null, 2);
        details.appendChild(summary);
        details.appendChild(pre);
        item.appendChild(details);
      }

      fragment.appendChild(item);
    });

    this.listElement.appendChild(fragment);
  }

  renderStats() {
    if (!this.statsElement || !this.lastStats) {
      return;
    }
    const { total, levels = {}, firstTimestamp, lastTimestamp } = this.lastStats;
    this.statsElement.innerHTML = `
      <div class="activity-stats__item"><span class="activity-stats__label">Entries</span><span class="activity-stats__value">${total ?? 0}</span></div>
      <div class="activity-stats__item"><span class="activity-stats__label">Errors</span><span class="activity-stats__value">${levels.error ?? 0}</span></div>
      <div class="activity-stats__item"><span class="activity-stats__label">Warnings</span><span class="activity-stats__value">${levels.warn ?? 0}</span></div>
      <div class="activity-stats__item"><span class="activity-stats__label">First</span><span class="activity-stats__value">${formatTimestamp(firstTimestamp)}</span></div>
      <div class="activity-stats__item"><span class="activity-stats__label">Last</span><span class="activity-stats__value">${formatTimestamp(lastTimestamp)}</span></div>
    `;
  }

  renderError(message) {
    if (!this.listElement) return;
    this.listElement.innerHTML = '';
    const item = document.createElement('li');
    item.className = 'activity-entry activity-entry--error';
    item.textContent = message;
    this.listElement.appendChild(item);
  }

  updateConnectionStatus({ connected, hint, reason, error }) {
    if (!this.statusElement) return;
    this.statusElement.dataset.state = connected ? 'online' : 'offline';
    const statusText = connected ? 'Live' : 'Offline';
    let meta = '';
    if (error) meta = error;
    else if (reason) meta = reason;
    else if (hint) meta = hint;

    const label = this.statusElement.querySelector('.activity-status__label');
    const hintElement = this.statusElement.querySelector('.activity-status__hint');

    if (label) {
      label.textContent = statusText;
    }
    if (hintElement) {
      hintElement.textContent = meta || '';
    }
  }

  async exportSnapshot() {
    if (this.connected && this.webcomm) {
      try {
        this.webcomm.send(JSON.stringify({
          type: 'github-activity:command',
          command: 'export',
          limit: this.snapshotLimit
        }));
        return;
      } catch (error) {
        this.logger?.warn?.('[ActivityFeed] WebSocket export failed, falling back to HTTP', error);
      }
    }

    try {
      const snapshot = await this.api.fetchActivitySnapshot({ limit: this.snapshotLimit });
      const entries = snapshot.data || snapshot.entries || [];
      this.downloadEntries(entries, 'github-activity-export.json');
    } catch (error) {
      this.renderError(error instanceof GitHubSyncError ? error.message : 'Failed to export activity.');
    }
  }

  downloadEntries(entries, filename) {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 100);
    } catch (error) {
      this.logger?.warn?.('[ActivityFeed] Failed to trigger export download', error);
    }
  }
}
