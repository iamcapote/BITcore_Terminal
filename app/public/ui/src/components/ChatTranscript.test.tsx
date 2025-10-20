/* @vitest-environment jsdom */
/**
 * Why: Ensure the modern chat transcript preview renders expected copy and reacts to theme changes.
 * What: Mounts the ChatTranscript inside ThemeProvider and inspects static bubbles and footer controls.
 * How: Seeds localStorage or dataset to drive theme selection, renders via Testing Library, and asserts DOM state for modern vs hacker skins.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatTranscript } from './ChatTranscript';
import { ThemeProvider } from '../theme/ThemeProvider';

function renderWithTheme() {
  return render(
    <ThemeProvider>
      <ChatTranscript />
    </ThemeProvider>
  );
}

describe('ChatTranscript', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  it('renders sample transcript and disables compose controls outside modern theme', () => {
    renderWithTheme();

    expect(screen.getByText('Chat Transcript')).toBeTruthy();
  expect(screen.getByText(/Ready to plan today/)).toBeTruthy();
    expect(screen.getByText('Switch to Modern theme for full effect')).toBeTruthy();
  const sendButton = screen.getByRole('button', { name: 'Send' });
  expect(sendButton.hasAttribute('disabled')).toBe(true);
  const input = screen.getByPlaceholderText('Type a message…');
  expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it('enables compose box and updates subtitle when modern theme is active', () => {
    window.localStorage.setItem('bitcore.ui.theme', 'modern');

    renderWithTheme();

  expect(screen.getByText('Modern chat skin preview')).toBeTruthy();
  const sendButton = screen.getByRole('button', { name: 'Send' });
  expect(sendButton.hasAttribute('disabled')).toBe(false);
  const input = screen.getByPlaceholderText('Type a message…');
  expect((input as HTMLInputElement).disabled).toBe(false);
  });
});
