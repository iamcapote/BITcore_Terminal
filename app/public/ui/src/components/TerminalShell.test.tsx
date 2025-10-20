/* @vitest-environment jsdom */
/**
 * Why: Ensure the terminal shell renders store history and forwards submissions to orchestrators.
 * What: Renders TerminalShell against a mocked virtual list and interacts with the input field.
 * How: Stubs react-window, seeds the Zustand store, and inspects store state and callbacks after events.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { TerminalShell } from './TerminalShell';
import { useTerminalStore } from '../stores/terminalStore';
import { ThemeProvider } from '../theme/ThemeProvider';

vi.mock('react-window', async () => {
  const React = await import('react');
  const { forwardRef, useEffect, useRef } = React;

  const List = forwardRef(function ListMock(props: any, _ref) {
    const { rowCount, rowComponent, onRowsRendered, rowProps = {} } = props;

    useEffect(() => {
      onRowsRendered?.(
        { startIndex: 0, stopIndex: Math.max(rowCount - 1, 0) },
        { startIndex: 0, stopIndex: Math.max(rowCount - 1, 0) }
      );
    }, [rowCount, onRowsRendered]);

    return (
      <div data-testid="mock-list">
        {Array.from({ length: rowCount }).map((_, index) => {
          const row = rowComponent({ 
            index, 
            style: {}, 
            ariaAttributes: {
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem'
            },
            ...rowProps
          });
          return React.createElement(React.Fragment, { key: index }, row);
        })}
      </div>
    );
  });

  function useListRef() {
    return useRef({
      scrollToRow: () => {}
    });
  }

  return {
    List,
    useListRef
  };
});

function resetStore(): void {
  useTerminalStore.getState().reset();
}

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('TerminalShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    act(() => {
      resetStore();
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    act(() => {
      resetStore();
    });
  });

  it('renders history entries from the terminal store', () => {
    act(() => {
      const store = useTerminalStore.getState();
      store.appendEntry({ text: 'boot logs', type: 'system' });
      store.appendEntry({ text: 'ready>', type: 'output' });
    });

    act(() => {
      renderWithTheme(<TerminalShell />);
    });

  expect(screen.getByText('boot logs').textContent).toBe('boot logs');
  expect(screen.getByText('ready>').textContent).toBe('ready>');
  });

  it('submits commands, appends entries, and resets the input', () => {
    const onSubmit = vi.fn();

    act(() => {
      renderWithTheme(<TerminalShell onSubmitCommand={onSubmit} />);
    });

    const input = screen.getByPlaceholderText('Type a command');
    act(() => {
      fireEvent.change(input, { target: { value: 'status' } });
    });

    act(() => {
      fireEvent.submit(input.closest('form')!);
    });

    expect(onSubmit).toHaveBeenCalledWith('status');
  const history = useTerminalStore.getState().history;
  expect(history.at(-2)?.text).toBe('▶ status');
  expect(history.at(-1)?.text).toBe('… awaiting response');
    expect(useTerminalStore.getState().input).toBe('');
  });
});
