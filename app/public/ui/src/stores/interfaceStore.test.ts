/**
 * Why: Verify the interface store keeps focus mode state transitions deterministic.
 * What: Asserts enter, exit, and toggle helpers mutate the boolean flag as expected.
 * How: Exercises the Zustand store directly to avoid coupling tests to React components.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { getInterfaceSnapshot, useInterfaceStore } from './interfaceStore';

afterEach(() => {
  useInterfaceStore.setState({ isFocusMode: false, isSettingsOpen: false });
});

describe('useInterfaceStore', () => {
  it('enters focus mode', () => {
    useInterfaceStore.getState().enterFocusMode();
    expect(getInterfaceSnapshot().isFocusMode).toBe(true);
  });

  it('exits focus mode', () => {
    useInterfaceStore.setState({ isFocusMode: true });
    useInterfaceStore.getState().exitFocusMode();
    expect(getInterfaceSnapshot().isFocusMode).toBe(false);
  });

  it('toggles focus mode', () => {
    useInterfaceStore.getState().toggleFocusMode();
    expect(getInterfaceSnapshot().isFocusMode).toBe(true);
    useInterfaceStore.getState().toggleFocusMode();
    expect(getInterfaceSnapshot().isFocusMode).toBe(false);
  });

  it('controls settings drawer visibility', () => {
    useInterfaceStore.getState().openSettings();
    expect(getInterfaceSnapshot().isSettingsOpen).toBe(true);
    useInterfaceStore.getState().toggleSettings();
    expect(getInterfaceSnapshot().isSettingsOpen).toBe(false);
    useInterfaceStore.getState().closeSettings();
    expect(getInterfaceSnapshot().isSettingsOpen).toBe(false);
  });
});
