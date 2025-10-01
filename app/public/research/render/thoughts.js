/**
 * Research Renderers: Thoughts
 * Why: Present streaming telemetry thoughts in the dashboard UI.
 * What: Defines window.renderThoughts for reuse by telemetry updates.
 * How: Builds list entries from telemetryState.thoughts and cached DOM refs.
 */
(function registerResearchThoughtsRender(global) {
  if (!global) {
    return;
  }

  global.renderThoughts = function renderThoughts() {
    if (!els.thoughts) return;
    els.thoughts.innerHTML = '';

    if (!telemetryState.thoughts.length) {
      const empty = document.createElement('li');
      empty.className = 'telemetry-empty';
      empty.textContent = 'No thoughts received yet.';
      els.thoughts.appendChild(empty);
      return;
    }

    telemetryState.thoughts.forEach((thought) => {
      const item = document.createElement('li');
      item.className = 'telemetry-thought';

      const stage = document.createElement('span');
      stage.className = 'telemetry-thought-stage';
      stage.textContent = thought.stage ? `[${thought.stage}]` : '[thought]';

      const text = document.createElement('span');
      text.className = 'telemetry-thought-text';
      text.textContent = thought.text;

      item.append(stage, text);
      els.thoughts.appendChild(item);
    });
  };
})(typeof window !== 'undefined' ? window : undefined);
