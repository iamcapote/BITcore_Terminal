/* @vitest-environment jsdom */
/**
 * Why: Validate the memory timeline renders commit history and reacts to store updates.
 * What: Renders the component, mutates the timeline store, and verifies synopsis text alongside event badges.
 * How: Uses Testing Library with React act helpers to append entries and update statuses while inspecting the DOM.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MemoryTimeline } from './MemoryTimeline';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useMemoryTimelineStore } from '../stores/memoryTimelineStore';

afterEach(() => {
  act(() => {
    useMemoryTimelineStore.getState().reset();
  });
});

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('MemoryTimeline', () => {
  it('renders default events and sync summary', () => {
    renderWithTheme(<MemoryTimeline />);

    expect(screen.getByText('Memory Timeline')).toBeTruthy();
    expect(screen.getByText(/GitHub sync running/i)).toBeTruthy();

    const events = screen.getAllByTestId('memory-event');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].textContent).toContain('GitHub sync in progress');
  });

  it('responds to appended events and status changes', () => {
    renderWithTheme(<MemoryTimeline />);

    act(() => {
      useMemoryTimelineStore.getState().appendEvent({
        id: 'commit-latest',
        kind: 'commit',
        title: 'Commit: Timeline test',
        description: 'Testing timeline update.',
        status: 'completed',
        timestamp: Date.parse('2025-10-19T18:30:00Z'),
        repo: 'iamcapote/bitcore-memory',
        branch: 'main',
        commitSha: 'feed123'
      });
    });

    const events = screen.getAllByTestId('memory-event');
    expect(events[0].textContent).toContain('Commit: Timeline test');

    act(() => {
      useMemoryTimelineStore.getState().updateEvent('commit-latest', { status: 'failed' });
    });

    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
  });

  it('updates sync summary when degradation occurs', () => {
    renderWithTheme(<MemoryTimeline />);

    act(() => {
      useMemoryTimelineStore.getState().updateEvent('sync-active', { status: 'failed' });
    });

    expect(screen.getByText(/GitHub sync degraded/i)).toBeTruthy();
  });
});
