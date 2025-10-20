/**
 * Why: Guard the command palette store contract so UI components can rely on predictable open and query behavior.
 * What: Exercises open/close transitions and query updates without involving React components.
 * How: Interacts with the Zustand store directly and inspects snapshots after each mutation.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { useCommandPaletteStore } from './commandPaletteStore';

describe('commandPaletteStore', () => {
  afterEach(() => {
    useCommandPaletteStore.getState().close();
  });

  it('opens the palette and resets the query', () => {
    useCommandPaletteStore.setState({ query: 'prefill' });
    useCommandPaletteStore.getState().open();

    const state = useCommandPaletteStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe('');
  });

  it('allows updating the query while open', () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().setQuery('research');

    expect(useCommandPaletteStore.getState().query).toBe('research');
  });
});
