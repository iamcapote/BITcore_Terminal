export function ensureWebComm() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (window.webcomm && typeof window.webcomm.registerHandler === 'function') {
    return window.webcomm;
  }
  if (typeof window.WebComm !== 'function') {
    console.warn('[GitHubSyncDashboard] WebComm client is unavailable.');
    return null;
  }
  const instance = new window.WebComm('/api/research/ws');
  if (typeof instance.connect === 'function') {
    instance.connect().catch((error) => {
      console.warn('[GitHubSyncDashboard] WebSocket connection failed:', error);
    });
  }
  window.webcomm = instance;
  return instance;
}

export function formatTimestamp(value) {
  if (!value) return '—';
  const target = typeof value === 'number' ? new Date(value) : new Date(Number(value) || String(value));
  if (Number.isNaN(target.getTime())) {
    return String(value);
  }
  return `${target.toLocaleDateString()} ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

export function formatFileSize(bytes) {
  const numeric = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 'FILE';
  }
  if (numeric === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1);
  const value = numeric / (1024 ** exponent);
  const precision = exponent === 0 ? 0 : (value < 10 ? 1 : 0);
  return `${value.toFixed(precision)} ${units[exponent]}`;
}
