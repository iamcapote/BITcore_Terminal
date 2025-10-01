/**
 * Organizer Utility Helpers
 * Why: Provide shared DOM helpers and formatters for scheduler, mission, and prompt modules.
 * What: Exposes organizerUtils with query, formatting, and clipboard helpers reused across modules.
 * How: Captures a relative time formatter once and re-exports pure helper functions.
 */
(function initializeOrganizerUtils(global) {
  if (!global || global.organizerUtils) {
    return;
  }

  const relativeTimeFormatter = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null;

  function byId(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function formatRelativeTime(input) {
    if (!input) return '—';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    if (!relativeTimeFormatter) {
      return date.toLocaleString();
    }
    const diffMs = date.getTime() - Date.now();
    const diffSec = Math.round(diffMs / 1000);
    const pairs = [
      { unit: 'day', value: 86400 },
      { unit: 'hour', value: 3600 },
      { unit: 'minute', value: 60 },
      { unit: 'second', value: 1 }
    ];
    for (const pair of pairs) {
      const amount = diffSec / pair.value;
      if (Math.abs(amount) >= 1 || pair.unit === 'second') {
        return relativeTimeFormatter.format(Math.round(amount), pair.unit);
      }
    }
    return date.toLocaleString();
  }

  function appendEmptyState(container, message) {
    if (!container) return;
    const entry = document.createElement('li');
    entry.className = 'organizer-empty';
    entry.textContent = message;
    container.appendChild(entry);
  }

  function truncate(text, maxLength) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  function describeSchedule(schedule) {
    if (!schedule) return 'No schedule';
    if (schedule.type === 'interval' && Number.isFinite(schedule.intervalMinutes)) {
      const minutes = schedule.intervalMinutes;
      if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return `Every ${hours === 1 ? 'hour' : `${hours} hours`}`;
      }
      return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    if (schedule.type === 'cron' && schedule.cron) {
      return `Cron: ${schedule.cron}`;
    }
    return 'Custom schedule';
  }

  function formatStatus(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  async function readError(response) {
    try {
      const body = await response.json();
      return body?.error || body?.message || null;
    } catch (error) {
      return null;
    }
  }

  async function copyToClipboard(text) {
    if (typeof text !== 'string') {
      throw new Error('Nothing to copy.');
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    const selection = document.getSelection();
    const range = selection ? selection.rangeCount > 0 && selection.getRangeAt(0) : null;
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      if (!successful) {
        throw new Error('Copy command was rejected');
      }
    } finally {
      document.body.removeChild(textarea);
      if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  global.organizerUtils = Object.freeze({
    byId,
    formatRelativeTime,
    appendEmptyState,
    truncate,
    describeSchedule,
    formatStatus,
    readError,
    copyToClipboard
  });
})(typeof window !== 'undefined' ? window : undefined);
