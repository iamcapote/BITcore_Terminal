/**
 * Why: Share consistent relative time formatting across telemetry and timeline surfaces without duplicating logic.
 * What: Exposes helper functions that translate timestamps into concise human-readable phrases.
 * How: Computes elapsed intervals from a reference time and returns strings tuned for dashboard summaries.
 */

/**
 * Formats a timestamp relative to the provided reference time (defaults to Date.now()) using short English units.
 */
export function formatRelativeTime(timestamp: number | null, referenceTime: number = Date.now()): string {
  if (!timestamp) {
    return 'Never';
  }

  const deltaMs = Math.max(0, referenceTime - timestamp);
  const deltaSeconds = Math.floor(deltaMs / 1000);

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}
