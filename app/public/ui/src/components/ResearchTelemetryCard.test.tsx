/* @vitest-environment jsdom */
/**
 * Why: Confirm the telemetry card reflects store state for progress, stages, and token statistics.
 * What: Renders the card, manipulates the telemetry store, and inspects the DOM for derived values.
 * How: Uses Testing Library with Vitest to update store actions inside React act calls and assert visual outputs.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ResearchTelemetryCard } from './ResearchTelemetryCard';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useResearchTelemetryStore } from '../stores/researchTelemetryStore';

afterEach(() => {
  act(() => {
    useResearchTelemetryStore.getState().reset();
  });
});

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ResearchTelemetryCard', () => {
  it('renders default snapshot with idle status', () => {
    renderWithTheme(<ResearchTelemetryCard />);

    expect(screen.getByText('Research Telemetry')).toBeTruthy();
    expect(screen.getByText('Idle')).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();
  });

  it('updates progress and stage after store mutations', () => {
    renderWithTheme(<ResearchTelemetryCard />);

    act(() => {
      useResearchTelemetryStore.getState().start({ depth: 3, breadth: 2 });
      useResearchTelemetryStore.getState().updateStage('executing');
      useResearchTelemetryStore.getState().updateProgress(72);
    });

    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('Depth 3 · Breadth 2', { exact: false })).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByLabelText('Research stage timeline').textContent).toContain('Executing');
  });

  it('displays token usage aggregates', () => {
    renderWithTheme(<ResearchTelemetryCard />);

    act(() => {
      useResearchTelemetryStore.getState().recordTokenUsage({
        timestamp: Date.now(),
        totalTokens: 1845,
        promptTokens: 612,
        completionTokens: 1233
      });
    });

    expect(screen.getByText('1.8k')).toBeTruthy();
    expect(screen.getByText('612')).toBeTruthy();
    expect(screen.getByText('1.2k')).toBeTruthy();
  });
});
