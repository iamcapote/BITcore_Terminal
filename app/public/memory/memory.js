/**
 * Memory Dashboard UI Controller
 *
 * Provides an interactive view over the memory subsystem including metrics,
 * store/recall workflows, and live telemetry streamed via the shared WebSocket.
 */

const METRICS_ENDPOINT = '/api/memory/stats';
const STORE_ENDPOINT = '/api/memory/store';
const RECALL_ENDPOINT = '/api/memory/recall';

const TELEMETRY_LIMIT = 25;
const ACTIVITY_LIMIT = 10;

const layerLabel = {
    episodic: 'episodic (default)',
    working: 'working (short)',
    semantic: 'semantic (long)'
};

class MemoryDashboard {
    constructor() {
        this.metricsEl = document.getElementById('memory-metrics');
        this.layerListEl = document.getElementById('layer-breakdown');
        this.activityFeedEl = document.getElementById('activity-feed');
        this.telemetryFeedEl = document.getElementById('telemetry-feed');
        this.telemetryStatusEl = document.getElementById('telemetry-status');

        this.layerTotals = new Map();
        this.activityItems = [];
        this.telemetryEvents = [];

        this.webcomm = null;

        this.attachEventHandlers();
        this.connectWebSocket();
        this.fetchMetrics();
    }

    get tabButtons() {
        return Array.from(document.querySelectorAll('.memory-tab'));
    }

    get panels() {
        return Array.from(document.querySelectorAll('.memory-panel'));
    }

    attachEventHandlers() {
        document.getElementById('refresh-metrics')?.addEventListener('click', () => this.fetchMetrics());
        document.getElementById('memory-store-form')?.addEventListener('submit', event => this.storeMemory(event));
        document.getElementById('memory-recall-form')?.addEventListener('submit', event => this.recallMemory(event));
        document.getElementById('clear-results')?.addEventListener('click', () => this.clearResults());

        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.activateTab(button.dataset.tab));
        });
    }

    activateTab(tab) {
        this.tabButtons.forEach(button => {
            const isActive = button.dataset.tab === tab;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        this.panels.forEach(panel => {
            const isActive = panel.id === `panel-${tab}`;
            panel.classList.toggle('active', isActive);
            if (isActive) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', '');
            }
        });
    }

    async fetchMetrics() {
        this.renderMetricsPlaceholder('Loading metrics…');
        try {
            const response = await fetch(METRICS_ENDPOINT, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load metrics');
            const stats = await response.json();
            this.renderMetrics(stats);
            this.updateLayerBreakdown(stats);
        } catch (error) {
            this.renderMetricsPlaceholder(error.message || 'Unable to load metrics.');
        }
    }

    renderMetricsPlaceholder(message) {
        if (!this.metricsEl) return;
        this.metricsEl.innerHTML = `<div class="metrics-placeholder">${message}</div>`;
    }

    renderMetrics(stats) {
        if (!this.metricsEl) return;

        if (!stats || !stats.totals) {
            this.renderMetricsPlaceholder('No metrics available yet. Interact with memory to generate data.');
            return;
        }

        const { totals } = stats;
        const cards = [
            { label: 'Stored', value: totals.stored ?? 0 },
            { label: 'Recalled', value: totals.retrieved ?? 0 },
            { label: 'Validated', value: totals.validated ?? 0 }
        ];

        const cardsHtml = cards.map(card => `
            <article class="metric-card">
                <span class="metric-label">${card.label}</span>
                <span class="metric-value">${card.value}</span>
            </article>
        `).join('');

        const trendHtml = Array.isArray(stats.layers) && stats.layers.length
            ? `<table class="metric-table">
                    <thead>
                        <tr><th>Layer</th><th>Depth</th><th>Stored</th><th>Recalled</th></tr>
                    </thead>
                    <tbody>
                        ${stats.layers.map(layer => `
                            <tr>
                                <td>${layer.layer}</td>
                                <td>${layer.depth}</td>
                                <td>${layer.stored}</td>
                                <td>${layer.retrieved}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            : '<div class="metrics-placeholder">No layer data yet.</div>';

        this.metricsEl.innerHTML = `
            <div class="metric-card-grid">${cardsHtml}</div>
            <div class="metrics-updated">Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            ${trendHtml}
        `;
    }

    updateLayerBreakdown(stats) {
        if (!this.layerListEl) return;

        const layers = Array.isArray(stats?.layers) ? stats.layers : [];
        this.layerTotals.clear();
        layers.forEach(layer => {
            this.layerTotals.set(layer.layer, layer);
        });

        if (!layers.length) {
            this.layerListEl.innerHTML = '<li class="memory-empty">No layer activity yet.</li>';
            return;
        }

        const items = layers.map(layer => {
            const label = layerLabel[layer.layer] || layer.layer;
            const ratio = layer.stored ? Math.round((layer.retrieved / Math.max(layer.stored, 1)) * 100) : 0;
            return `<li>
                <div class="layer-row">
                    <span class="layer-name">${label}</span>
                    <span class="layer-counts">${layer.stored} stored · ${layer.retrieved} recalled</span>
                </div>
                <div class="layer-ratio">
                    <div class="layer-ratio-fill" style="width:${ratio}%"></div>
                </div>
            </li>`;
        });

        this.layerListEl.innerHTML = items.join('');
    }

    async storeMemory(event) {
        event.preventDefault();

        const content = document.getElementById('store-content').value.trim();
        const statusEl = document.getElementById('store-status');
        if (!content) {
            statusEl.textContent = 'Content is required.';
            return;
        }

        const payload = {
            content,
            layer: document.getElementById('store-layer').value,
            source: document.getElementById('store-source').value.trim() || undefined,
            tags: document.getElementById('store-tags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean),
            githubEnabled: document.getElementById('store-github').checked
        };

        statusEl.textContent = 'Storing memory…';

        try {
            const response = await fetch(STORE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody?.error || 'Failed to store memory.');
            }

            const record = await response.json();
            statusEl.textContent = 'Memory stored successfully.';
            document.getElementById('store-content').value = '';
            document.getElementById('store-tags').value = '';
            document.getElementById('store-source').value = '';

            this.prependActivity({
                label: 'Memory stored',
                detail: `${record.layer ?? 'unknown'} layer • ${record.tags?.slice(0, 3).join(', ') || 'no tags'}`,
                timestamp: record.timestamp || new Date().toISOString()
            });

            this.renderRecallResults([record]);
            this.fetchMetrics();
            this.activateTab('results');
        } catch (error) {
            statusEl.textContent = error.message;
        }
    }

    async recallMemory(event) {
        event.preventDefault();

        const query = document.getElementById('recall-query').value.trim();
        const statusEl = document.getElementById('recall-status');
        if (!query) {
            statusEl.textContent = 'Query is required.';
            return;
        }

        const payload = {
            query,
            layer: document.getElementById('recall-layer').value,
            limit: Number.parseInt(document.getElementById('recall-limit').value, 10) || undefined,
            includeShortTerm: document.getElementById('recall-short').checked,
            includeLongTerm: document.getElementById('recall-long').checked,
            includeMeta: document.getElementById('recall-meta').checked,
            githubEnabled: document.getElementById('recall-github').checked
        };

        statusEl.textContent = 'Recalling memories…';

        try {
            const response = await fetch(RECALL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody?.error || 'Failed to recall memories.');
            }

            const records = await response.json();
            if (Array.isArray(records) && records.length) {
                statusEl.textContent = `Found ${records.length} memor${records.length === 1 ? 'y' : 'ies'}.`;
            } else {
                statusEl.textContent = 'No memories found.';
            }

            this.renderRecallResults(records);
            this.activateTab('results');
        } catch (error) {
            statusEl.textContent = error.message;
        }
    }

    clearResults() {
        const container = document.getElementById('recall-results');
        if (container) {
            container.innerHTML = '<div class="memory-empty">Recall results cleared.</div>';
        }
    }

    renderRecallResults(records) {
        const container = document.getElementById('recall-results');
        if (!container) return;

        if (!Array.isArray(records) || !records.length) {
            container.innerHTML = '<div class="memory-empty">No memories to display.</div>';
            return;
        }

        container.innerHTML = records.map((record, index) => {
            const tags = Array.isArray(record.tags) && record.tags.length
                ? record.tags.slice(0, 8).map(tag => `<span class="memory-tag-chip">${tag}</span>`).join(' ')
                : '<span class="memory-tag-chip memory-tag-empty">No tags</span>';

            return `<article class="memory-card">
                <header class="memory-card-header">
                    <span class="memory-layer">${(record.layer || 'unknown').toUpperCase()}</span>
                    <span class="memory-index">#${index + 1}</span>
                </header>
                <p class="memory-card-content">${record.content || '(no content provided)'}</p>
                <footer class="memory-card-footer">
                    <div class="memory-card-tags">${tags}</div>
                    <div class="memory-metadata">
                        <span>${record.source || record.metadata?.source || 'unspecified source'}</span>
                        <span>${record.timestamp ? new Date(record.timestamp).toLocaleString() : 'n/a'}</span>
                    </div>
                </footer>
            </article>`;
        }).join('');
    }

    prependActivity(entry) {
        if (!this.activityFeedEl) return;

        this.activityItems.unshift(entry);
        if (this.activityItems.length > ACTIVITY_LIMIT) {
            this.activityItems.length = ACTIVITY_LIMIT;
        }

        this.activityFeedEl.innerHTML = this.activityItems.map(item => `
            <li>
                <div class="activity-title">${item.label}</div>
                <div class="activity-detail">${item.detail || ''}</div>
                <div class="activity-meta">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            </li>
        `).join('');
    }

    connectWebSocket() {
        if (this.webcomm || typeof WebComm !== 'function') {
            this.telemetryStatus('unavailable');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/api/research/ws`;
        this.webcomm = new WebComm(url);

        this.webcomm.registerHandler('connection', message => this.handleConnection(message));
        this.webcomm.registerHandler('memory_event', message => this.handleMemoryEvent(message));
        this.webcomm.registerHandler('enable_input', () => {});
        this.webcomm.registerHandler('disable_input', () => {});

        this.webcomm.connect().catch(error => {
            console.warn('[MemoryDashboard] WebSocket connection failed', error);
            this.telemetryStatus('error', 'Disconnected');
        });
    }

    handleConnection(message) {
        if (message?.connected) {
            this.telemetryStatus('connected', 'Live');
        } else {
            this.telemetryStatus('disconnected', message?.reason || 'Disconnected');
        }
    }

    handleMemoryEvent(message) {
        if (!message || message.type !== 'memory_event') return;

        const description = this.describeMemoryEvent(message);
        if (!description) return;

        this.telemetryEvents.unshift(description);
        if (this.telemetryEvents.length > TELEMETRY_LIMIT) {
            this.telemetryEvents.length = TELEMETRY_LIMIT;
        }

        if (!this.telemetryFeedEl) return;

        this.telemetryFeedEl.innerHTML = this.telemetryEvents.map(event => `
            <article class="telemetry-card">
                <header>
                    <span class="telemetry-event">${event.label}</span>
                    <span class="telemetry-time">${event.time}</span>
                </header>
                <div class="telemetry-detail">${event.detail}</div>
            </article>
        `).join('');

        this.telemetryStatus('connected', 'Live');

        if (message.event === 'store' || message.event === 'stats') {
            this.fetchMetrics();
        }
    }

    describeMemoryEvent(message) {
        const time = new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const event = message.event;
        const data = message.data || {};

        switch (event) {
            case 'store': {
                const record = data.record || {};
                const detail = record.preview || '(no preview)';
                this.prependActivity({
                    label: 'Store operation',
                    detail: `${record.layer || 'unknown'} layer • ${detail.slice(0, 80)}`,
                    timestamp: message.timestamp
                });
                return { label: 'Stored memory', time, detail };
            }
            case 'recall': {
                const count = data.resultsCount ?? 0;
                const query = data.query || 'Untitled query';
                this.prependActivity({
                    label: 'Recall executed',
                    detail: `${count} result${count === 1 ? '' : 's'} • "${query.slice(0, 40)}"`,
                    timestamp: message.timestamp
                });
                return { label: 'Recall', time, detail: `${count} result${count === 1 ? '' : 's'} for "${query}"` };
            }
            case 'stats': {
                return { label: 'Stats refreshed', time, detail: 'Totals updated from controller.' };
            }
            case 'summarize': {
                return { label: data.success === false ? 'Summarize failed' : 'Summarize', time, detail: data.success === false ? 'Venice enrichment failed.' : 'Summary generated.' };
            }
            default:
                return { label: `Event: ${event}`, time, detail: JSON.stringify(data) };
        }
    }

    telemetryStatus(state, text = '') {
        if (!this.telemetryStatusEl) return;
        const label = text || state;
        this.telemetryStatusEl.textContent = label;
        this.telemetryStatusEl.className = `telemetry-status telemetry-${state}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.memoryDashboard = new MemoryDashboard();
});
