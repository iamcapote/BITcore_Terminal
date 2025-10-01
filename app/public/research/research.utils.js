/**
 * Research Dashboard Utility Helpers
 * Why: Share normalizers and formatting helpers across telemetry, render, prompt, and GitHub modules.
 * What: Provides pure functions for shaping data, truncating content, formatting timestamps, and clipboard interactions.
 * How: Exposes globally scoped helpers that operate on plain inputs and return sanitized, presentation-friendly values.
 */
function normalizeThought(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return { text: payload, stage: 'telemetry' };
  }
  const text = payload.text || payload.message || '';
  if (!text.trim()) return null;
  return {
    text: text.trim(),
    stage: payload.stage || payload.source || 'telemetry'
  };
}

function normalizeMemoryRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const preview = typeof record.preview === 'string' && record.preview.trim()
    ? record.preview.trim()
    : typeof record.content === 'string'
      ? record.content.trim()
      : '';
  if (!preview) return null;

  const tags = Array.isArray(record.tags)
    ? record.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
    : [];

  return {
    id: record.id ? String(record.id).slice(0, 36) : null,
    layer: record.layer ? String(record.layer) : null,
    preview,
    tags,
    source: record.source || null,
    score: typeof record.score === 'number' ? Math.min(1, Math.max(0, record.score)) : null,
    timestamp: record.timestamp || null
  };
}

function formatStage(stage) {
  if (!stage) return 'In Progress';
  return stage
    .toString()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeTime(timestamp) {
  try {
    const now = Date.now();
    const diff = now - Number(timestamp);
    if (!Number.isFinite(diff)) return '';
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  } catch (error) {
    return '';
  }
}

function formatAbsoluteTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    return '';
  }
}

function firstTruthyString(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function truncateText(text, maxLength = 200) {
  if (typeof text !== 'string') {
    return '';
  }
  const trimmed = text.trim();
  if (!maxLength || trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, numeric));
  return Number.isNaN(clamped) ? null : clamped;
}

function coerceTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatSuggestionSource(source) {
  if (!source) return 'Memory';
  const normalized = source.toString().trim();
  if (!normalized) return 'Memory';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

async function copyTextToClipboard(text, button, {
  restoreLabel,
  successLabel = 'Copied!',
  failureLabel = 'Copy failed',
  durationMs = 1400
} = {}) {
  if (typeof text !== 'string' || !text.trim()) return;

  const originalLabel = restoreLabel ?? button?.dataset?.restoreLabel ?? button?.textContent;
  const finalText = text.trim();

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(finalText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = finalText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (button) {
      button.disabled = true;
      button.textContent = successLabel;
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel || restoreLabel || 'Copy';
      }, durationMs);
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = failureLabel;
      window.setTimeout(() => {
        button.textContent = originalLabel || restoreLabel || 'Copy';
      }, durationMs + 200);
    }
    throw error;
  }
}

function normalizeGitHubActivityEntry(entry) {
  if (!entry) return null;
  const message = typeof entry.message === 'string' ? entry.message.trim() : '';
  if (!message) return null;
  const level = typeof entry.level === 'string' ? entry.level.trim().toLowerCase() : 'info';
  const timestamp = Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now();
  const meta = entry.meta && typeof entry.meta === 'object' ? { ...entry.meta } : null;
  const action = entry.action ?? meta?.action ?? null;
  return {
    id: entry.id ?? null,
    level,
    message,
    timestamp,
    action,
    meta,
    source: entry.source || 'server'
  };
}

function pushGitHubActivityEntry(entry, { dedupeWindowMs = 2500 } = {}) {
  const normalized = normalizeGitHubActivityEntry(entry);
  if (!normalized) {
    return false;
  }

  if (normalized.id && githubState.seenActivityIds.has(normalized.id)) {
    return false;
  }

  if (normalized.id) {
    githubState.seenActivityIds.add(normalized.id);
  }

  if (dedupeWindowMs > 0) {
    const recentDuplicate = githubState.audit.find((item) =>
      item.level === normalized.level &&
      item.message === normalized.message &&
      Math.abs(item.timestamp - normalized.timestamp) <= dedupeWindowMs
    );
    if (recentDuplicate) {
      return false;
    }
  }

  githubState.audit.unshift(normalized);
  if (githubState.audit.length > MAX_GITHUB_ACTIVITY) {
    githubState.audit.length = MAX_GITHUB_ACTIVITY;
  }
  return true;
}

function hydrateGitHubActivity(entries = []) {
  githubState.audit = [];
  githubState.seenActivityIds = new Set();
  const ordered = entries
    .map((entry) => normalizeGitHubActivityEntry(entry))
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  ordered.forEach((entry) => {
    pushGitHubActivityEntry(entry, { dedupeWindowMs: 0 });
  });

  renderGitHubActivity();
}

function logGitHubActivity(message, level = 'info', meta = null) {
  if (!message) {
    return;
  }
  const entry = {
    message,
    level,
    timestamp: Date.now(),
    meta,
    source: 'client'
  };
  const added = pushGitHubActivityEntry(entry, { dedupeWindowMs: 4000 });
  if (added) {
    renderGitHubActivity();
  }
}
