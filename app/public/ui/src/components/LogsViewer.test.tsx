/* @vitest-environment jsdom */
/**
 * Why: Confirm the logs viewer respects level filters, search, and streaming indicators.
 * What: Renders the component, toggles severity buttons, performs searches, and verifies appended log entries appear.
 * How: Uses Testing Library with Vitest, mutating the logs store inside React act wrappers.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LogsViewer } from './LogsViewer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useLogsViewerStore } from '../stores/logsViewerStore';

afterEach(() => {
  act(() => {
    useLogsViewerStore.getState().reset();
  });
});

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('LogsViewer', () => {
  it('renders default logs and stats', () => {
    renderWithTheme(<LogsViewer />);

    expect(screen.getByText('Logs Tail')).toBeTruthy();
    expect(screen.getAllByTestId('log-entry').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Info/ })).toBeTruthy();
  });

  it('filters by severity and search query', () => {
    renderWithTheme(<LogsViewer />);

  fireEvent.click(screen.getByRole('button', { name: /Info/ }));
  fireEvent.click(screen.getByRole('button', { name: /Warn/ }));

    let entries = screen.getAllByTestId('log-entry');
    expect(entries.every((entry) => entry.textContent?.includes('Error'))).toBe(true);

    const input = screen.getByLabelText('Filter logs');
    fireEvent.change(input, { target: { value: 'github' } });

    entries = screen.getAllByTestId('log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('github.sync');
  });

  it('responds to appended entries and streaming flag', () => {
    renderWithTheme(<LogsViewer />);

    act(() => {
      useLogsViewerStore.getState().setStreaming(true);
      useLogsViewerStore.getState().appendEntry({
        id: 'log-new',
        level: 'info',
        message: 'New log streamed.',
        source: 'test.runner',
        timestamp: Date.now()
      });
    });

    expect(screen.getByText(/Streaming live updates/)).toBeTruthy();
    expect(screen.getAllByTestId('log-entry')[0].textContent).toContain('New log streamed.');
  });
});
