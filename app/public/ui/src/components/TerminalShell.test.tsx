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
  const { forwardRef, useEffect, useImperativeHandle } = React;

  const FixedSizeList = forwardRef(function FixedSizeListMock(props: any, ref) {
    const { itemCount, children, onItemsRendered } = props;

    useImperativeHandle(ref, () => ({
      scrollToItem: () => {}
    }));

    useEffect(() => {
      onItemsRendered?.({
        overscanStartIndex: 0,
        overscanStopIndex: Math.max(itemCount - 1, 0),
        visibleStartIndex: Math.max(itemCount - 1, 0),
        visibleStopIndex: Math.max(itemCount - 1, 0)
      });
    }, [itemCount, onItemsRendered]);

    return (
      <div data-testid="mock-list">
        {Array.from({ length: itemCount }).map((_, index) => {
          const row = children({ index, style: {}, data: undefined, isScrolling: false });
          return React.createElement(React.Fragment, { key: index }, row);
        })}
      </div>
    );
  });

  return {
    FixedSizeList
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
