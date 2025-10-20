/**
 * Why: Present a tailing log view with severity filters so operators can monitor runtime signals alongside telemetry.
 * What: Renders level chips, search input, and a scrollable stream of log entries with status badges and relative timestamps.
 * How: Subscribes to the logs store, applies filters, and maps entries into a card layout using shared design primitives.
 */

import { useMemo } from 'react';

import { Card } from './primitives/Card';
import { Input } from './primitives/Input';
import { formatRelativeTime } from '../utils/time';
import {
  filterLogs,
  getLogStats,
  type LogLevel,
  useLogsViewerStore
} from '../stores/logsViewerStore';

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

const LEVEL_STYLES: Record<LogLevel, { label: string; color: string }> = {
  debug: { label: 'Debug', color: 'var(--color-muted)' },
  info: { label: 'Info', color: 'var(--color-accent-primary)' },
  warn: { label: 'Warn', color: 'var(--color-warning)' },
  error: { label: 'Error', color: 'var(--color-danger)' }
};

function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function LogsViewer(): JSX.Element {
  const entries = useLogsViewerStore((state) => state.entries);
  const activeLevels = useLogsViewerStore((state) => state.activeLevels);
  const searchQuery = useLogsViewerStore((state) => state.searchQuery);
  const streaming = useLogsViewerStore((state) => state.streaming);
  const toggleLevel = useLogsViewerStore((state) => state.toggleLevel);
  const setSearchQuery = useLogsViewerStore((state) => state.setSearchQuery);
  const clearFilters = useLogsViewerStore((state) => state.clearFilters);

  const filteredEntries = useMemo(() => filterLogs(entries, activeLevels, searchQuery), [entries, activeLevels, searchQuery]);
  const stats = useMemo(() => getLogStats(entries), [entries]);
  const lastEntry = filteredEntries[0];
  const subtitle = streaming
    ? 'Streaming live updates'
    : lastEntry
      ? `Last log ${formatRelativeTime(lastEntry.timestamp)}`
      : 'No recent entries';

  return (
    <Card title="Logs Tail" subtitle={subtitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm)',
            alignItems: 'center'
          }}
        >
          {LEVEL_ORDER.map((level) => {
            const style = LEVEL_STYLES[level];
            const isActive = activeLevels.has(level) || activeLevels.size === 0;
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--radii-full)',
                  border: isActive ? `1px solid ${style.color}` : '1px solid var(--color-border)',
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent-secondary) 12%, transparent)' : 'transparent',
                  color: style.color,
                  cursor: 'pointer',
                  fontFamily: 'var(--typography-font-family-mono)',
                  fontSize: 'var(--typography-font-size-xs)'
                }}
                aria-pressed={isActive}
              >
                <span>{style.label}</span>
                <span style={{ color: 'var(--color-muted)' }}>{stats.byLevel[level]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={clearFilters}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderRadius: 'var(--radii-full)',
              border: '1px dashed var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--typography-font-family-mono)',
              fontSize: 'var(--typography-font-size-xs)'
            }}
          >
            Reset
          </button>
          <div style={{ flex: '1 1 180px', minWidth: '200px' }}>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search message or source"
              aria-label="Filter logs"
            />
          </div>
        </div>
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radii-md)',
            backgroundColor: 'var(--color-bg-surface)',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {filteredEntries.length === 0 && (
            <p style={{ margin: 'var(--spacing-lg)', color: 'var(--color-muted)' }}>No log entries match the selected filters.</p>
          )}
          {filteredEntries.map((entry) => {
            const style = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                data-testid="log-entry"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 80px 1fr',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: '1px solid var(--color-border)',
                  fontFamily: 'var(--typography-font-family-mono)',
                  fontSize: 'var(--typography-font-size-xs)',
                  color: 'var(--color-fg-primary)'
                }}
              >
                <span style={{ color: 'var(--color-muted)' }}>{formatTimeOfDay(entry.timestamp)}</span>
                <span style={{ color: style.color, textTransform: 'uppercase' }}>{style.label}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  <span>{entry.message}</span>
                  <span style={{ color: 'var(--color-muted)' }}>{entry.source}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
