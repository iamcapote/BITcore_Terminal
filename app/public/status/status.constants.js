(function initializeStatusConstants(global) {
  const STATE_CLASSES = Object.freeze([
    'status-active',
    'status-warning',
    'status-error',
    'status-missing',
    'status-checking',
    'status-unknown'
  ]);

  const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

  const PRESENCE_CONFIG = Object.freeze({
    telemetry: Object.freeze({
      label: 'Telemetry Feed',
      preferencePath: 'widgets.telemetryIndicator',
      idleMessage: 'Awaiting telemetry…',
      activeMessage: 'Telemetry streaming',
      decayMs: 45000
    }),
    logs: Object.freeze({
      label: 'Log Stream',
      preferencePath: 'widgets.logIndicator',
      idleMessage: 'No recent logs',
      activeMessage: 'Log activity detected',
      decayMs: 30000
    })
  });

  function parseBooleanLike(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function getNestedPreference(preferences, path, fallback = true) {
    if (!preferences || !path) return fallback;
    const segments = path.split('.');
    let current = preferences;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return fallback;
      }
      current = current[segment];
    }
    return parseBooleanLike(current, fallback);
  }

  global.statusConfig = Object.freeze({
    STATE_CLASSES,
    TRUE_VALUES,
    PRESENCE_CONFIG,
    parseBooleanLike,
    getNestedPreference
  });
})(typeof window !== 'undefined' ? window : globalThis);
