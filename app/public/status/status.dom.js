(function initializeStatusDom(global) {
  const { STATE_CLASSES } = global.statusConfig || {};

  function formatMetaSummary(key, meta) {
    if (!meta || typeof meta !== 'object') {
      return '';
    }

    switch (key) {
      case 'venice':
      case 'brave': {
        if (!meta.configured) {
          return 'Not configured';
        }
        const sources = [];
        if (meta.userScoped) sources.push('user key');
        if (meta.envScoped) sources.push('env var');
        return sources.length ? `Sources: ${sources.join(' + ')}` : 'Configured';
      }
      case 'github': {
        const parts = [];
        if (meta.repository) parts.push(meta.repository);
        if (meta.branch) parts.push(`branch ${meta.branch}`);
        if (meta.hasToken) parts.push('token set');
        if (meta.verified) parts.push('verified');
        if (!parts.length) {
          return meta.hasConfig ? 'Configured' : 'Repository missing';
        }
        return parts.join(' · ');
      }
      case 'memory': {
        if (meta.error) {
          return `Error: ${meta.error}`;
        }
        if (meta.mode === 'github') {
          return meta.githubVerified ? 'GitHub sync (verified)' : 'GitHub sync pending verification';
        }
        if (meta.mode === 'local-fallback') {
          return 'Local fallback (GitHub unavailable)';
        }
        if (meta.mode === 'local') {
          return 'Local mode';
        }
        return meta.githubConfigured ? 'GitHub configured' : '';
      }
      default: {
        const entries = Object.entries(meta)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        return entries.join(' · ');
      }
    }
  }

  function ensureMetaElement(element) {
    let metaElement = element.querySelector('[data-status-role="meta"]');
    if (!metaElement) {
      metaElement = document.createElement('span');
      metaElement.className = 'status-chip-meta';
      metaElement.dataset.statusRole = 'meta';
      element.appendChild(metaElement);
    }
    return metaElement;
  }

  function updateStatusElement(element, info, { fallbackLabel } = {}) {
    if (!element) return;
    const state = info?.state || 'unknown';
    STATE_CLASSES.forEach((cls) => element.classList.remove(cls));
    element.classList.add(`status-${state}`);
    element.dataset.state = state;

    const fallback = fallbackLabel || element.dataset.statusLabel || element.dataset.statusKey || 'Status';

    const labelElement = element.querySelector('[data-status-role="label"]');
    if (labelElement) {
      labelElement.textContent = info?.label || fallback;
    }

    const messageElement = element.querySelector('[data-status-role="message"]');
    if (messageElement) {
      messageElement.textContent = info?.message || 'Unknown';
    }

    const key = element.dataset.statusKey || element.dataset.presenceKey;
    const metaSummary = formatMetaSummary(key, info?.meta);
    const metaElement = ensureMetaElement(element);
    if (metaSummary) {
      metaElement.textContent = metaSummary;
      metaElement.classList.remove('is-hidden');
    } else {
      metaElement.textContent = '';
      metaElement.classList.add('is-hidden');
    }

    const tooltipParts = [info?.message || fallback];
    if (metaSummary) {
      tooltipParts.push(metaSummary);
    }
    element.title = tooltipParts.filter(Boolean).join(' • ');
  }

  global.statusDom = Object.freeze({
    updateStatusElement,
    formatMetaSummary
  });
})(typeof window !== 'undefined' ? window : globalThis);
