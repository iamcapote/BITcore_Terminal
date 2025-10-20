/* @vitest-environment jsdom */
/**
 * Why: Ensure global keyboard shortcuts open the command palette and toggle focus mode reliably.
 * What: Mounts the hook, simulates key combinations, and asserts the associated stores update correctly.
 * How: Uses Testing Library utilities with Vitest to dispatch keydown events on window and focused elements.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

import { useCommandPaletteStore } from '../stores/commandPaletteStore';
import { getInterfaceSnapshot, useInterfaceStore } from '../stores/interfaceStore';
import { useGlobalShortcuts } from './useGlobalShortcuts';

function TestComponent(): null {
  useGlobalShortcuts();
  return null;
}

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().close();
    act(() => {
      useInterfaceStore.setState({ isFocusMode: false, isSettingsOpen: false });
    });
  });

  afterEach(() => {
    useCommandPaletteStore.getState().close();
    act(() => {
      useInterfaceStore.setState({ isFocusMode: false, isSettingsOpen: false });
    });
  });

  it('opens the command palette with meta/cmd + k', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it('opens the command palette with ctrl + k on non-mac devices', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it('ignores shortcuts while editing text inputs', () => {
    render(
      <>
        <TestComponent />
        <input data-testid="shortcut-input" />
      </>
    );

    const input = document.querySelector('[data-testid="shortcut-input"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('toggles focus mode with meta/cmd + shift + f', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(getInterfaceSnapshot().isFocusMode).toBe(true);
  });

  it('toggles focus mode with ctrl + shift + f', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });

    expect(getInterfaceSnapshot().isFocusMode).toBe(true);
  });

  it('exits focus mode when pressing escape', () => {
    render(<TestComponent />);

    act(() => {
      useInterfaceStore.setState({ isFocusMode: true });
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(getInterfaceSnapshot().isFocusMode).toBe(false);
  });

  it('opens the settings drawer with meta/cmd + ,', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: ',', metaKey: true });

    expect(useInterfaceStore.getState().isSettingsOpen).toBe(true);
  });

  it('opens the settings drawer with ctrl + ,', () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: ',', ctrlKey: true });

    expect(useInterfaceStore.getState().isSettingsOpen).toBe(true);
  });
});
