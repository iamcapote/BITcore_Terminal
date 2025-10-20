/* @vitest-environment jsdom */
/**
 * Why: Verify the hacker console skin surfaces ANSI colors and reduced chrome styling in the terminal shell.
 * What: Renders the terminal within ThemeProvider while seeding history entries, then inspects CSS variables and inline styles.
 * How: Forces the hacker theme via localStorage, appends entries through the store, and queries DOM nodes through Testing Library.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalShell } from './TerminalShell';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useTerminalStore } from '../stores/terminalStore';

vi.mock('react-window', async () => {
  const React = await import('react');
  const { cloneElement, forwardRef, useEffect, useRef } = React;

  const List = forwardRef(function ListMock(props: any, _ref) {
    const { rowCount, rowComponent, onRowsRendered, rowProps = {} } = props;

    useEffect(() => {
      onRowsRendered?.(
        { startIndex: 0, stopIndex: rowCount - 1 },
        { startIndex: 0, stopIndex: rowCount - 1 }
      );
    }, [rowCount, onRowsRendered]);

    return (
      <div data-testid="fixed-size-list">
        {Array.from({ length: rowCount }).map((_, index) => 
          cloneElement(rowComponent({ 
            index, 
            style: {},
            ariaAttributes: {
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem'
            },
            ...rowProps
          }), { key: index })
        )}
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

function renderWithTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('TerminalShell hacker theme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('bitcore.ui.theme', 'hacker');
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
    act(() => {
      useTerminalStore.getState().reset();
      useTerminalStore.getState().appendEntry({ type: 'input', text: 'ls -la' });
      useTerminalStore.getState().appendEntry({ type: 'system', text: '… awaiting response' });
      useTerminalStore.getState().appendEntry({ type: 'output', text: 'README.md' });
    });
  });

  afterEach(() => {
    act(() => {
      useTerminalStore.getState().reset();
    });
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  it('applies hacker dataset and low-chrome panel styling', () => {
    renderWithTheme(<TerminalShell height={72} rowHeight={24} />);

    expect(document.documentElement.dataset.theme).toBe('hacker');
    const panel = screen.getByTestId('fixed-size-list').parentElement as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.style.border).toBe('1px solid var(--terminal-border, rgba(20, 241, 255, 0.28))');
    expect(panel?.style.background).toBe('var(--terminal-bg, var(--color-bg-secondary))');
  });

  it('renders input/system/output rows using ANSI color ramp', () => {
    renderWithTheme(<TerminalShell height={72} rowHeight={24} />);

    const inputRow = screen.getByText('ls -la');
    const systemRow = screen.getByText('… awaiting response');
    const outputRow = screen.getByText('README.md');
  const promptSpan = document.querySelector('form span') as HTMLElement | null;

    expect(inputRow.style.color).toBe('var(--ansi-green)');
    expect(systemRow.style.color).toBe('var(--ansi-magenta)');
    expect(outputRow.style.color).toBe('var(--ansi-cyan)');
    expect(promptSpan?.style.color).toBe('var(--ansi-green)');
  });
});
