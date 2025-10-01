/**
 * Research Renderers: Memory
 * Why: Visualize memory stats and sampled records alongside research telemetry.
 * What: Provides window.renderMemory relied upon by telemetry service updates.
 * How: Consumes telemetryState.memory + shared formatters for timestamps.
 */
(function registerResearchMemoryRender(global) {
  if (!global) {
    return;
  }

  global.renderMemory = function renderMemory() {
    if (!els.memorySummary || !els.memoryList) return;

    const { stats, records } = telemetryState.memory;
    if (stats) {
      const parts = [];
      if (Number.isFinite(stats.stored)) parts.push(`Stored: ${stats.stored}`);
      if (Number.isFinite(stats.retrieved)) parts.push(`Retrieved: ${stats.retrieved}`);
      if (Number.isFinite(stats.summarized)) parts.push(`Summaries: ${stats.summarized}`);
      if (Number.isFinite(stats.validated)) parts.push(`Validated: ${stats.validated}`);
      els.memorySummary.textContent = parts.length ? parts.join(' • ') : 'Memory stats available.';
    } else {
      els.memorySummary.textContent = 'No memory context yet.';
    }

    els.memoryList.innerHTML = '';
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'telemetry-empty';
      empty.textContent = 'Awaiting memory samples linked to this research run.';
      els.memoryList.appendChild(empty);
      return;
    }

    records.forEach((record) => {
      const card = document.createElement('article');
      card.className = 'memory-record-card';

      const header = document.createElement('header');
      header.className = 'memory-record-header';

      const layer = document.createElement('span');
      layer.className = 'memory-layer-chip';
      layer.textContent = record.layer || 'memory';
      header.appendChild(layer);

      if (record.score !== null) {
        const score = document.createElement('span');
        score.className = 'memory-score';
        score.textContent = `Score: ${(record.score * 100).toFixed(0)}%`;
        header.appendChild(score);
      }

      if (record.timestamp) {
        const timestamp = document.createElement('time');
        timestamp.className = 'memory-timestamp';
        timestamp.dateTime = new Date(record.timestamp).toISOString();
        timestamp.textContent = formatRelativeTime(record.timestamp);
        header.appendChild(timestamp);
      }

      const preview = document.createElement('p');
      preview.className = 'memory-record-preview';
      preview.textContent = record.preview;

      const tags = document.createElement('div');
      tags.className = 'memory-record-tags';
      if (record.tags.length) {
        record.tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'memory-tag-chip';
          chip.textContent = tag;
          tags.appendChild(chip);
        });
      }

      const footer = document.createElement('footer');
      footer.className = 'memory-record-footer';
      if (record.source) {
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'memory-source';
        link.textContent = record.source;
        link.title = record.source;
        link.addEventListener('click', (event) => event.preventDefault());
        footer.appendChild(link);
      }
      if (record.id) {
        const id = document.createElement('span');
        id.className = 'memory-record-id';
        id.textContent = record.id;
        footer.appendChild(id);
      }

      card.append(header, preview);
      if (record.tags.length) card.appendChild(tags);
      if (footer.childNodes.length) card.appendChild(footer);
      els.memoryList.appendChild(card);
    });
  };
})(typeof window !== 'undefined' ? window : undefined);
