/**
 * Why: Give operators a quick read on memory commits and GitHub sync health alongside console telemetry.
 * What: Displays a timeline of recent commits, sync pushes, and consolidation jobs with status badges and summary stats.
 * How: Reads the memory timeline store, derives sync health, and renders a vertical timeline inside the shared card primitive.
 */

import { useMemo } from 'react';

import { Card } from './primitives/Card';
import { formatRelativeTime } from '../utils/time';
import {
  summarizeMemorySync,
  type MemorySyncSummary,
  type MemoryTimelineEntry,
  type MemoryTimelineStatus,
  useMemoryTimelineStore
} from '../stores/memoryTimelineStore';

const STATUS_COPY: Record<MemoryTimelineStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
  failed: 'Failed'
};

const STATUS_COLORS: Record<MemoryTimelineStatus, { background: string; color: string }> = {
  pending: {
    background: 'color-mix(in srgb, var(--color-warning, #F7C948) 18%, transparent)',
    color: 'var(--color-warning, #F7C948)'
  },
  'in-progress': {
    background: 'color-mix(in srgb, var(--color-accent-secondary) 22%, transparent)',
    color: 'var(--color-accent-secondary)'
  },
  completed: {
    background: 'color-mix(in srgb, var(--color-accent-primary) 18%, transparent)',
    color: 'var(--color-accent-primary)'
  },
  failed: {
    background: 'color-mix(in srgb, var(--color-danger, #FF5470) 22%, transparent)',
    color: 'var(--color-danger, #FF5470)'
  }
};

function pluralize(value: number, noun: string): string {
  const suffix = value === 1 ? '' : 's';
  return `${value} ${noun}${suffix}`;
}

function buildSyncSubtitle(summary: MemorySyncSummary): string {
  if (summary.status === 'degraded') {
    return `GitHub sync degraded — ${pluralize(summary.failedUploads, 'failure')} detected`;
  }
  if (summary.status === 'syncing') {
    return `GitHub sync running — ${pluralize(summary.inFlightUploads, 'upload')} in flight`;
  }
  if (summary.status === 'stale') {
    return `GitHub sync pending — ${pluralize(summary.unsyncedCommits, 'commit')} awaiting push`;
  }
  const lastSync = summary.lastSyncedAt ? formatRelativeTime(summary.lastSyncedAt) : 'Never';
  return `GitHub sync healthy — last push ${lastSync}`;
}

function renderMetadata(event: MemoryTimelineEntry): JSX.Element | null {
  const badges: JSX.Element[] = [];

  if (event.repo) {
    badges.push(
      <span key="repo" style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
        {event.repo}
        {event.branch ? `@${event.branch}` : ''}
      </span>
    );
  }

  if (event.commitSha) {
    badges.push(
      <span key="sha" style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
        sha {event.commitSha}
      </span>
    );
  }

  if (event.target) {
    badges.push(
      <span key="target" style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
        {event.target}
      </span>
    );
  }

  if (event.tags) {
    for (const tag of event.tags) {
      badges.push(
        <span
          key={tag}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radii-full)',
            padding: '0 var(--spacing-xs)',
            fontFamily: 'var(--typography-font-family-mono)'
          }}
        >
          #{tag}
        </span>
      );
    }
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        flexWrap: 'wrap',
        fontSize: 'var(--typography-font-size-xs)',
        color: 'var(--color-muted)'
      }}
    >
      {badges}
    </div>
  );
}

function TimelineItem({ event }: { event: MemoryTimelineEntry }): JSX.Element {
  const palette = STATUS_COLORS[event.status];
  const relativeTime = formatRelativeTime(event.timestamp);

  return (
    <div
      data-testid="memory-event"
      style={{ position: 'relative', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'calc(-1 * var(--spacing-lg) - 6px)',
          top: '6px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: palette.color,
          boxShadow: '0 0 0 2px var(--color-bg-secondary)'
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          flexWrap: 'wrap'
        }}
      >
        <strong style={{ fontFamily: 'var(--typography-font-family-mono)' }}>{event.title}</strong>
        <span style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)' }}>{relativeTime}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: '0 var(--spacing-sm)',
            borderRadius: 'var(--radii-full)',
            backgroundColor: palette.background,
            color: palette.color,
            fontSize: 'var(--typography-font-size-xs)',
            fontFamily: 'var(--typography-font-family-mono)'
          }}
        >
          {STATUS_COPY[event.status]}
        </span>
      </div>
      <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>{event.description}</p>
      {renderMetadata(event)}
    </div>
  );
}

export function MemoryTimeline(): JSX.Element {
  const events = useMemoryTimelineStore((state) => state.events);
  const summary = useMemo(() => summarizeMemorySync(events), [events]);
  const subtitle = buildSyncSubtitle(summary);

  const stats = [
    { label: 'Commits', value: summary.totalCommits },
    { label: 'Unsynced', value: summary.unsyncedCommits },
    { label: 'In Flight', value: summary.inFlightUploads },
    { label: 'Failures', value: summary.failedUploads }
  ];

  return (
    <Card title="Memory Timeline" subtitle={subtitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 'var(--spacing-md)',
            fontFamily: 'var(--typography-font-family-mono)'
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <div style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)', textTransform: 'uppercase' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 'var(--typography-font-size-sm)' }}>{stat.value}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'relative',
            borderLeft: '1px solid var(--color-border)',
            paddingLeft: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)'
          }}
        >
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      </div>
    </Card>
  );
}
