/* @vitest-environment jsdom */
/**
 * Why: Ensure the prompt modal renders variant-specific controls and wires callbacks for form submissions.
 * What: Opens modal variants through the store and interacts with the rendered inputs/buttons to assert resolver calls.
 * How: Uses Testing Library with Zustand store helpers to orchestrate password, confirm, and select flows.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { PromptModal } from './PromptModal';
import { usePromptModalStore } from '../stores/promptModalStore';

describe('PromptModal', () => {
  afterEach(() => {
    act(() => {
      usePromptModalStore.getState().reset();
    });
  });

  it('submits password values through the store', () => {
    const handler = vi.fn();
    act(() => {
      usePromptModalStore.getState().openPassword({
        title: 'Secret',
        message: 'Provide secret',
        onSubmit: handler
      });
    });

    render(<PromptModal />);

    const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: 'hunter2' } });
      fireEvent.submit(input.closest('form')!);
    });

    expect(handler).toHaveBeenCalledWith('hunter2');
  });

  it('handles confirm modal actions', () => {
    const handler = vi.fn();
    act(() => {
      usePromptModalStore.getState().openConfirm({
        title: 'Proceed',
        message: 'Ready?',
        onSubmit: handler
      });
    });

    render(<PromptModal />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    act(() => {
      fireEvent.click(confirmButton);
    });

    expect(handler).toHaveBeenCalledWith(true);
  });

  it('cancels select prompt when cancel button pressed', () => {
    const cancelHandler = vi.fn();
    act(() => {
      usePromptModalStore.getState().openSelect({
        title: 'Format',
        message: 'Choose',
        options: ['Markdown'],
        onCancel: cancelHandler
      });
    });

    render(<PromptModal />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    act(() => {
      fireEvent.click(cancelButton);
    });

    expect(cancelHandler).toHaveBeenCalledTimes(1);
  });
});
