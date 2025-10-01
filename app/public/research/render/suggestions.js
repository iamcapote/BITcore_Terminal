/**
 * Research Renderers: Suggestions
 * Why: Surface follow-up prompt suggestions generated during research runs.
 * What: Implements window.renderSuggestions consumed by telemetry updates.
 * How: Formats metadata, tags, and copy actions with existing DOM bindings.
 */
(function registerResearchSuggestionsRender(global) {
  if (!global) {
    return;
  }

  global.renderSuggestions = function renderSuggestions() {
    if (!els.suggestionsList || !els.suggestionsMeta) return;

    const items = Array.isArray(telemetryState.suggestions.items)
      ? telemetryState.suggestions.items
      : [];
    const sourceLabel = formatSuggestionSource(telemetryState.suggestions.source);
    const generatedAt = telemetryState.suggestions.generatedAt;

    const metaParts = [];
    if (sourceLabel) metaParts.push(`Source: ${sourceLabel}`);
    if (Number.isFinite(generatedAt)) metaParts.push(`Updated ${formatRelativeTime(generatedAt)}`);

    if (metaParts.length) {
      els.suggestionsMeta.textContent = metaParts.join(' • ');
    } else {
      els.suggestionsMeta.textContent = 'Suggestions will appear once memory intelligence is available.';
    }

    els.suggestionsList.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'telemetry-empty';
      empty.textContent = 'Waiting for memory to surface relevant follow-up prompts.';
      els.suggestionsList.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const entry = document.createElement('li');
      entry.className = 'telemetry-suggestion';
      entry.dataset.index = index.toString();

      const prompt = document.createElement('p');
      prompt.className = 'telemetry-suggestion-prompt';
      prompt.textContent = item.prompt;
      entry.appendChild(prompt);

      const metaBits = [];
      if (item.focus) metaBits.push(`Focus: ${item.focus}`);
      if (item.layer) metaBits.push(`Layer: ${item.layer}`);
      if (typeof item.score === 'number' && Number.isFinite(item.score)) {
        metaBits.push(`Match ${Math.round(item.score * 100)}%`);
      }
      if (metaBits.length) {
        const meta = document.createElement('div');
        meta.className = 'telemetry-suggestion-meta';
        meta.textContent = metaBits.join(' • ');
        entry.appendChild(meta);
      }

      if (item.tags && item.tags.length) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'telemetry-suggestion-tags';
        item.tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'telemetry-suggestion-tag';
          chip.textContent = tag;
          tagsContainer.appendChild(chip);
        });
        entry.appendChild(tagsContainer);
      }

      const footer = document.createElement('div');
      footer.className = 'telemetry-suggestion-footer';

      if (item.memoryId) {
        const id = document.createElement('span');
        id.className = 'telemetry-suggestion-id';
        id.textContent = item.memoryId;
        footer.appendChild(id);
      }

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'telemetry-suggestion-action';
      copyButton.dataset.action = 'copy';
      copyButton.dataset.index = index.toString();
      copyButton.dataset.restoreLabel = 'Copy prompt';
      copyButton.textContent = 'Copy prompt';
      footer.appendChild(copyButton);

      entry.appendChild(footer);
      els.suggestionsList.appendChild(entry);
    });
  };
})(typeof window !== 'undefined' ? window : undefined);
