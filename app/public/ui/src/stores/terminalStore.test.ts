/**
 * Why: Verify the terminal store maintains invariants for history and input control.
 * What: Exercises append, toggle, and reset actions to ensure consumers see consistent state.
 * How: Manipulates the Zustand store directly and inspects snapshots between operations.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { getTerminalSnapshot, useTerminalStore } from './terminalStore';

function resetStore(): void {
  useTerminalStore.getState().reset();
}

describe('terminalStore', () => {
  afterEach(() => {
    resetStore();
  });

  it('starts with the command mode and empty history', () => {
    const snapshot = getTerminalSnapshot();
    expect(snapshot.mode).toBe('command');
    expect(snapshot.prompt).toBe('▶ ');
    expect(snapshot.history).toEqual([]);
  });

  it('appends entries with generated ids and timestamps when missing', () => {
    useTerminalStore.getState().appendEntry({ text: 'hello', type: 'output' });

    const [entry] = getTerminalSnapshot().history;
    expect(entry.text).toBe('hello');
    expect(entry.type).toBe('output');
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('toggles input availability and resets back to defaults', () => {
    const store = useTerminalStore.getState();
    store.disableInput();
    store.setPrompt('$ ');
    store.setMode('chat');
    store.setInput('draft');

    expect(getTerminalSnapshot().inputDisabled).toBe(true);

    store.reset();
    const snapshot = getTerminalSnapshot();
    expect(snapshot.mode).toBe('command');
    expect(snapshot.prompt).toBe('▶ ');
    expect(snapshot.inputDisabled).toBe(false);
    expect(snapshot.input).toBe('');
  });
});
