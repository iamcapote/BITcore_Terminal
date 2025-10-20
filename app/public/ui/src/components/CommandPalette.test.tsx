/* @vitest-environment jsdom */
/**
 * Why: Validate the command palette's fuzzy filtering and selection hooks before wiring backend orchestration.
 * What: Opens the palette via the store, executes search interactions, and asserts that callbacks receive the expected metadata.
 * How: Uses Testing Library to simulate typing and keyboard navigation while inspecting the mocked run handler.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { CommandPalette } from './CommandPalette';
import { useCommandPaletteStore } from '../stores/commandPaletteStore';

function openPalette(): void {
  act(() => {
    useCommandPaletteStore.getState().open();
  });
}

function closePalette(): void {
  act(() => {
    useCommandPaletteStore.getState().close();
  });
}

describe('CommandPalette', () => {
  beforeEach(() => {
    closePalette();
  });

  afterEach(() => {
    closePalette();
  });

  it('renders the default command catalog when opened', () => {
    const handler = vi.fn();
    openPalette();
    render(<CommandPalette onRunCommand={handler} />);

    expect(screen.getByPlaceholderText('Search commands...')).toBeTruthy();
    expect(screen.getByText('/research <query>').textContent).toContain('/research <query>');
    expect(screen.getByText('/keys set <provider>').textContent).toContain('/keys set <provider>');
  });

  it('filters commands using fuzzy search', () => {
    const handler = vi.fn();
    openPalette();
    render(<CommandPalette onRunCommand={handler} />);

    const input = screen.getByPlaceholderText('Search commands...');
    act(() => {
      fireEvent.change(input, { target: { value: 'memory' } });
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toContain('/memory stats');
  });

  it('invokes the run callback after filtering and pressing enter', () => {
    const handler = vi.fn();
    openPalette();
    render(<CommandPalette onRunCommand={handler} />);

    const input = screen.getByPlaceholderText('Search commands...');
    act(() => {
      fireEvent.change(input, { target: { value: 'chat' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].name).toBe('/chat --memory');
  });
});
