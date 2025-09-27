/**
 * Terminal Persona Selector
 *
 * Renders a persona selector in the terminal status bar and keeps it in sync
 * with the chat persona controller exposed over HTTP. Persona changes apply to
 * subsequent /chat sessions and mirror the CLI persona subcommands.
 */

(function registerPersonaSelector(global) {
  const API_BASE = '/api/chat/personas';
  const terminal = () => global.terminal || null;

  const elements = {
    container: null,
    select: null,
    description: null,
    badge: null,
  };

  const state = {
    personas: [],
    defaultSlug: null,
    loading: false,
  };

  function ensureContainer() {
    if (elements.container) {
      return;
    }
    const statusBar = document.querySelector('.status-bar');
    if (!statusBar) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'persona-selector';

    const label = document.createElement('label');
    label.className = 'persona-selector__label';
    label.textContent = 'Persona';
    label.setAttribute('for', 'persona-selector');

    const select = document.createElement('select');
    select.id = 'persona-selector';
    select.className = 'persona-selector__select';
    select.disabled = true;

    const badge = document.createElement('span');
    badge.className = 'persona-selector__badge';
    badge.textContent = '';

    const description = document.createElement('p');
    description.className = 'persona-selector__description';
    description.textContent = 'Loading personas…';

    container.appendChild(label);
    container.appendChild(select);
    container.appendChild(badge);
    container.appendChild(description);
    statusBar.appendChild(container);

    elements.container = container;
    elements.select = select;
    elements.description = description;
    elements.badge = badge;
  }

  function renderBadge(slug) {
    if (!elements.badge) {
      return;
    }
    elements.badge.textContent = slug ? slug : '';
    elements.badge.hidden = !slug;
  }

  function renderDescription(persona) {
    if (!elements.description) {
      return;
    }
    if (!persona) {
      elements.description.textContent = 'No persona selected.';
      return;
    }
    elements.description.textContent = persona.description || `${persona.name} persona is active.`;
  }

  function renderOptions() {
    if (!elements.select) {
      return;
    }
    const select = elements.select;
    select.innerHTML = '';

    state.personas.forEach((persona) => {
      const option = document.createElement('option');
      option.value = persona.slug;
      option.textContent = persona.name;
      select.appendChild(option);
    });

    if (state.defaultSlug) {
      select.value = state.defaultSlug;
    }
    select.disabled = state.personas.length === 0;
    renderBadge(state.defaultSlug);
    const activePersona = state.personas.find((entry) => entry.slug === state.defaultSlug);
    renderDescription(activePersona || null);
  }

  async function fetchPersonas() {
    state.loading = true;
    try {
      const response = await fetch(API_BASE);
      if (!response.ok) {
        throw new Error(`Failed to load personas (${response.status})`);
      }
      const payload = await response.json();
      state.personas = Array.isArray(payload.personas) ? payload.personas : [];
      state.defaultSlug = payload.default?.slug || payload.defaultSlug || null;
      renderOptions();
    } catch (error) {
      console.warn('[terminal.chat.persona] Persona fetch failed:', error);
      if (elements.description) {
        elements.description.textContent = 'Unable to load personas.';
      }
      terminal()?.appendOutput?.(`Persona selector unavailable: ${error.message}`);
    } finally {
      state.loading = false;
      if (elements.select) {
        elements.select.disabled = state.personas.length === 0;
      }
    }
  }

  async function persistPersona(slug) {
    try {
      const response = await fetch(`${API_BASE}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(payload.error || `Failed to update persona (${response.status})`);
      }
      const result = await response.json();
      state.defaultSlug = result.persona?.slug || slug;
      renderOptions();
      terminal()?.appendOutput?.(`Persona set to ${result.persona?.name || slug}.`);
    } catch (error) {
      console.error('[terminal.chat.persona] Failed to persist persona:', error);
      terminal()?.appendOutput?.(`Persona update failed: ${error.message}`);
      renderOptions();
    }
  }

  function setupEventHandlers() {
    if (!elements.select) {
      return;
    }
    elements.select.addEventListener('change', (event) => {
      const slug = event.target.value;
      if (!slug || slug === state.defaultSlug) {
        renderOptions();
        return;
      }
      persistPersona(slug);
    });
  }

  function handleChatReady(event) {
    const detail = event?.detail || {};
    if (detail.slug) {
      state.defaultSlug = detail.slug;
      renderOptions();
    }
    if (detail.description) {
      renderDescription({ description: detail.description, name: detail.name || detail.slug });
    }
  }

  function handleWebcommChatReady(payload) {
    if (!payload || !payload.persona) {
      return;
    }
    state.defaultSlug = payload.persona.slug || payload.persona;
    renderOptions();
    renderDescription(payload.persona);
  }

  function init() {
    ensureContainer();
    if (!elements.select) {
      return;
    }
    setupEventHandlers();
    fetchPersonas();
  }

  document.addEventListener('DOMContentLoaded', init);
  global.addEventListener('chat-persona-ready', (event) => handleChatReady(event));

  if (global.webcomm && typeof global.webcomm.registerHandler === 'function') {
    global.webcomm.registerHandler('chat-ready', handleWebcommChatReady);
  }
})(window);
