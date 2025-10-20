/**
 * Why: Surface research telemetry data so operators can monitor progress without leaving the console prototype.
 * What: Renders a summary card combining progress, stage timeline, and token usage statistics pulled from the telemetry store.
 * How: Reads the Zustand store, derives timeline metadata, and composes primitives to present status details with accessible annotations.
 */

import { memo, useMemo } from 'react';

import { Card } from './primitives/Card';
import { ProgressRing } from './primitives/ProgressRing';
import type { ResearchStage } from '../stores/researchTelemetryStore';
import { getStageOrder, useResearchTelemetryStore } from '../stores/researchTelemetryStore';
import { formatRelativeTime } from '../utils/time';

const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning',
  executing: 'Executing',
  synthesizing: 'Synthesizing',
  complete: 'Complete'
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  complete: 'Complete',
  error: 'Needs attention'
};

function formatTokens(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${value}`;
}

function StageTimeline({ activeStage }: { activeStage: ResearchStage }): JSX.Element {
  const stages = useMemo(() => getStageOrder(), []);
  const activeIndex = stages.indexOf(activeStage);

  return (
    <ol
      aria-label="Research stage timeline"
      style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        listStyle: 'none',
        padding: 0,
        margin: 0
      }}
    >
      {stages.map((stage, index) => {
        const isActive = stage === activeStage;
        const isComplete = index < activeIndex;
        return (
          <li
            key={stage}
            aria-current={isActive ? 'step' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              color: isActive ? 'var(--color-accent-primary)' : isComplete ? 'var(--color-success)' : 'var(--color-muted)'
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isActive
                  ? 'var(--color-accent-primary)'
                  : isComplete
                    ? 'var(--color-success)'
                    : 'var(--color-border)'
              }}
            />
            <span style={{ fontSize: 'var(--typography-font-size-sm)', fontFamily: 'var(--typography-font-family-mono)' }}>
              {STAGE_LABELS[stage] ?? stage}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TokenStats(): JSX.Element {
  const samples = useResearchTelemetryStore((state) => state.tokenUsage);
  const latest = samples.at(-1);

  return (
    <dl
      style={{
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 'var(--spacing-sm)',
        fontFamily: 'var(--typography-font-family-mono)'
      }}
    >
      <div>
        <dt style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)', textTransform: 'uppercase' }}>Total</dt>
        <dd style={{ margin: 0, fontSize: 'var(--typography-font-size-sm)' }}>{formatTokens(latest?.totalTokens ?? 0)}</dd>
      </div>
      <div>
        <dt style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)', textTransform: 'uppercase' }}>Prompt</dt>
        <dd style={{ margin: 0, fontSize: 'var(--typography-font-size-sm)' }}>{formatTokens(latest?.promptTokens ?? 0)}</dd>
      </div>
      <div>
        <dt style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)', textTransform: 'uppercase' }}>Completion</dt>
        <dd style={{ margin: 0, fontSize: 'var(--typography-font-size-sm)' }}>{formatTokens(latest?.completionTokens ?? 0)}</dd>
      </div>
    </dl>
  );
}

export const ResearchTelemetryCard = memo(function ResearchTelemetryCard(): JSX.Element {
  const status = useResearchTelemetryStore((state) => state.status);
  const progress = useResearchTelemetryStore((state) => state.progress);
  const stage = useResearchTelemetryStore((state) => state.stage);
  const depth = useResearchTelemetryStore((state) => state.depth);
  const breadth = useResearchTelemetryStore((state) => state.breadth);
  const lastUpdated = useResearchTelemetryStore((state) => state.lastUpdated);
  const message = useResearchTelemetryStore((state) => state.message);

  const statusLabel = STATUS_LABELS[status] ?? status;
  const subtitle = `Depth ${depth} · Breadth ${breadth} · Updated ${formatRelativeTime(lastUpdated)}`;

  return (
    <Card title="Research Telemetry" subtitle={subtitle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: 'var(--spacing-lg)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <ProgressRing value={progress} size="lg" />
          <p
            style={{
              margin: 'var(--spacing-sm) 0 0',
              fontSize: 'var(--typography-font-size-sm)',
              color: status === 'error' ? 'var(--color-danger)' : 'var(--color-muted)'
            }}
          >
            {statusLabel}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <StageTimeline activeStage={stage} />
          <TokenStats />
          {message && (
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>{message}</p>
          )}
        </div>
      </div>
    </Card>
  );
});
