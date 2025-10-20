/* @vitest-environment jsdom */
/**
 * Why: Validate theme persistence, cycling, and keyboard affordances to keep GUI and CLI skins aligned.
 * What: Exercises the ThemeProvider hook surface to ensure state, storage, and DOM integration behave deterministically.
 * How: Renders a lightweight consumer with Testing Library and asserts dataset plus localStorage interactions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider, listAvailableThemes, useTheme } from './ThemeProvider';

function ThemeConsumer(): JSX.Element {
  const { theme, setTheme, cycleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={() => setTheme('modern')}>
        set-modern
      </button>
      <button type="button" onClick={cycleTheme}>
        cycle
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('initializes with the default hacker theme', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme-value').textContent).toBe('hacker');
    expect(document.documentElement.dataset.theme).toBe('hacker');
  });

  it('respects a stored preference', () => {
    window.localStorage.setItem('bitcore.ui.theme', 'retro');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme-value').textContent).toBe('retro');
    expect(document.documentElement.dataset.theme).toBe('retro');
  });

  it('updates theme when setTheme is invoked', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByText('set-modern'));
    expect(screen.getByTestId('theme-value').textContent).toBe('modern');
    expect(window.localStorage.getItem('bitcore.ui.theme')).toBe('modern');
  });

  it('cycles through themes on keyboard chord', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.keyDown(window, { key: 't', altKey: true, ctrlKey: true });
    expect(listAvailableThemes()).toContain(screen.getByTestId('theme-value').textContent);
    expect(screen.getByTestId('theme-value').textContent).toBe('modern');
  });
});
