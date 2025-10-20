/**
 * Why: Present terminal history and input within the React UI, paving the way for legacy bridge integration.
 * What: Virtualizes console output via react-window, renders mode-aware prompt, and emits stubbed submit events.
 * How: Reads from useTerminalStore, appends optimistic input/output entries, and exposes callbacks for future WebSocket wiring.
 */

import { useCallback, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { List, type ListImperativeAPI, type RowComponentProps, useListRef } from 'react-window';

import { Input } from './primitives';
import { useTerminalStore } from '../stores/terminalStore';
import { useTheme } from '../theme/ThemeProvider';

const DEFAULT_HEIGHT = 360;
const DEFAULT_ROW_HEIGHT = 24;

export interface TerminalShellProps {
  height?: number;
  rowHeight?: number;
  onSubmitCommand?: (command: string) => void;
}

export function TerminalShell({ height = DEFAULT_HEIGHT, rowHeight = DEFAULT_ROW_HEIGHT, onSubmitCommand }: TerminalShellProps): JSX.Element {
  const history = useTerminalStore((state) => state.history);
  const prompt = useTerminalStore((state) => state.prompt);
  const input = useTerminalStore((state) => state.input);
  const setInput = useTerminalStore((state) => state.setInput);
  const appendEntry = useTerminalStore((state) => state.appendEntry);
  const inputDisabled = useTerminalStore((state) => state.inputDisabled);
  const { theme } = useTheme();

  const listRef = useListRef();

  const handleRowsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStartIndex: number; visibleStopIndex: number }) => {
      const lastIndex = history.length - 1;
      if (visibleStopIndex >= lastIndex) {
        return;
      }
      listRef.current?.scrollToRow(lastIndex, 'end');
    },
    [history.length, listRef]
  );

  const renderRow = useCallback(
  ({ index, style }: RowComponentProps) => {
      const entry = history[index];
      const color = theme === 'hacker'
        ? entry.type === 'input'
          ? 'var(--ansi-green)'
          : entry.type === 'system'
            ? 'var(--ansi-magenta)'
            : 'var(--ansi-cyan)'
        : entry.type === 'input'
          ? 'var(--color-accent-primary)'
          : entry.type === 'system'
            ? 'var(--color-muted)'
            : 'var(--color-fg-primary)';
      return (
        <div
          style={{
            ...style,
            fontFamily: 'var(--typography-font-family-mono)',
            fontSize: 'var(--typography-font-size-sm)',
            color,
            paddingInline: 'var(--spacing-sm)'
          }}
        >
          {entry.text}
        </div>
      );
    },
    [history, theme]
  );

  const handleSubmit = useCallback(
  (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      appendEntry({ text: `${prompt}${trimmed}`, type: 'input' });
      appendEntry({ text: '… awaiting response', type: 'system' });
      setInput('');
      onSubmitCommand?.(trimmed);
    },
    [appendEntry, input, onSubmitCommand, prompt, setInput]
  );

  const itemKey = useCallback((index: number) => history[index]?.id ?? `${index}`, [history]);

  const listHeight = useMemo(() => Math.max(rowHeight, height), [height, rowHeight]);

  const panelStyle = useMemo(() => {
    if (theme === 'hacker') {
      return {
        border: '1px solid var(--terminal-border, rgba(20, 241, 255, 0.28))',
        borderRadius: 'var(--radii-md)',
        background: 'var(--terminal-bg, var(--color-bg-secondary))',
        boxShadow: 'inset 0 0 0 1px rgba(20, 241, 255, 0.06)',
        overflow: 'hidden'
      };
    }

    return {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radii-md)',
      background: 'var(--color-bg-secondary)',
      overflow: 'hidden'
    };
  }, [theme]);

  const promptColor = theme === 'hacker' ? 'var(--ansi-green)' : 'var(--color-accent-primary)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: `${listHeight}px auto`,
        gap: 'var(--spacing-md)',
        height: '100%'
      }}
    >
      <div style={panelStyle}>
        <List
          listRef={listRef}
          defaultHeight={listHeight}
          rowCount={history.length}
          rowHeight={rowHeight}
          onRowsRendered={handleRowsRendered}
          rowComponent={renderRow}
        />
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span style={{ color: promptColor, fontFamily: 'var(--typography-font-family-mono)' }}>{prompt}</span>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={inputDisabled}
          placeholder="Type a command"
          autoFocus
        />
      </form>
    </div>
  );
}
