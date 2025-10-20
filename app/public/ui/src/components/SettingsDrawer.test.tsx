/* @vitest-environment jsdom */
/**
 * Why: Confirm the settings drawer exposes theme switching controls backed by ThemeProvider.
 * What: Opens the drawer via interface store actions, interacts with theme buttons, and checks DOM effects.
 * How: Wraps the component in ThemeProvider, manipulates Zustand stores, and inspects dataset/localStorage side effects.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SettingsDrawer } from './SettingsDrawer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useInterfaceStore } from '../stores/interfaceStore';

function renderWithProviders() {
  return render(
    <ThemeProvider>
      <SettingsDrawer />
    </ThemeProvider>
  );
}

describe('SettingsDrawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
    act(() => {
      useInterfaceStore.setState({ isFocusMode: false, isSettingsOpen: false });
    });
  });

  afterEach(() => {
    act(() => {
      useInterfaceStore.setState({ isFocusMode: false, isSettingsOpen: false });
    });
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  it('shows theme buttons when opened and applies selection', () => {
    renderWithProviders();

    act(() => {
      useInterfaceStore.getState().openSettings();
    });

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toBeTruthy();
    const modernButton = screen.getByRole('button', { name: /modern/i });

    act(() => {
      fireEvent.click(modernButton);
    });

    expect(document.documentElement.dataset.theme).toBe('modern');
    expect(window.localStorage.getItem('bitcore.ui.theme')).toBe('modern');
  });

  it('closes when overlay is clicked', () => {
    renderWithProviders();

    act(() => {
      useInterfaceStore.getState().openSettings();
    });

    const overlay = screen.getByRole('presentation');
    act(() => {
      fireEvent.click(overlay);
    });

    expect(useInterfaceStore.getState().isSettingsOpen).toBe(false);
  });
});
