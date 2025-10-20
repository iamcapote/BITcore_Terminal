/**
 * Why: Showcase foundational primitives in isolation for rapid visual verification.
 * What: Demonstrates Button, Input, Card, and ProgressRing components with the active ThemeProvider.
 * How: Wraps stories in the ThemeProvider and uses inline layout helpers for clarity.
 */

import type { Story } from '@ladle/react';
import type { ReactNode } from 'react';

import { Button, Card, Input, ProgressRing } from '../src/components/primitives';
import { ThemeProvider } from '../src/theme/ThemeProvider';

function StoryFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ThemeProvider>
      <div
        style={{
          minHeight: '100vh',
          padding: 'var(--spacing-2xl)',
          background: 'var(--color-bg-primary)',
          color: 'var(--color-fg-primary)',
          display: 'grid',
          gap: 'var(--spacing-xl)'
        }}
      >
        {children}
      </div>
    </ThemeProvider>
  );
}

export const Buttons: Story = () => (
  <StoryFrame>
    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button intent="secondary">Secondary</Button>
      <Button intent="danger">Danger</Button>
    </div>
  </StoryFrame>
);

export const Inputs: Story = () => (
  <StoryFrame>
    <div style={{ maxWidth: 400, display: 'grid', gap: 'var(--spacing-md)' }}>
      <Input placeholder="Type a command" />
      <Input placeholder="Search" />
    </div>
  </StoryFrame>
);

export const Cards: Story = () => (
  <StoryFrame>
    <Card title="Telemetry" subtitle="Signal stream">
      <p style={{ margin: 0 }}>Use this space to render realtime charts and mission status snapshots.</p>
    </Card>
  </StoryFrame>
);

export const Progress: Story = () => (
  <StoryFrame>
    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center' }}>
      <ProgressRing value={25} size="sm" />
      <ProgressRing value={66} size="md" />
      <ProgressRing value={90} size="lg" color="var(--color-success)" />
    </div>
  </StoryFrame>
);

export default {
  title: 'Primitives'
};
