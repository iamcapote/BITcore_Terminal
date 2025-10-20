/**
 * Why: Lock down modal store invariants so UI flows can rely on reset behavior across prompt variants.
 * What: Opens each variant, triggers submit/cancel, and verifies callbacks plus state resets.
 * How: Invokes Zustand actions directly and inspects resulting state without rendering components.
 */

import { describe, expect, it, vi } from 'vitest';

import { usePromptModalStore } from './promptModalStore';

describe('promptModalStore', () => {
  it('opens password prompt and resets after submit', () => {
    const handler = vi.fn();
    usePromptModalStore.getState().openPassword({
      title: 'Secret',
      message: 'Enter',
      onSubmit: handler
    });

    expect(usePromptModalStore.getState().isOpen).toBe(true);
    usePromptModalStore.getState().submit('value');

    expect(handler).toHaveBeenCalledWith('value');
    expect(usePromptModalStore.getState().isOpen).toBe(false);
  });

  it('invokes cancel callback and resets state', () => {
    const cancelHandler = vi.fn();
    usePromptModalStore.getState().openConfirm({
      title: 'Confirm',
      message: 'Proceed?',
      onCancel: cancelHandler
    });

    usePromptModalStore.getState().cancel();
    expect(cancelHandler).toHaveBeenCalledTimes(1);
    expect(usePromptModalStore.getState().isOpen).toBe(false);
  });

  it('supports select prompts with option lists', () => {
    const handler = vi.fn();
    usePromptModalStore.getState().openSelect({
      title: 'Export',
      message: 'Choose format',
      options: ['Markdown', 'JSON'],
      onSubmit: handler
    });

    expect(usePromptModalStore.getState().options).toEqual(['Markdown', 'JSON']);
    usePromptModalStore.getState().submit('JSON');
    expect(handler).toHaveBeenCalledWith('JSON');
    expect(usePromptModalStore.getState().isOpen).toBe(false);
  });
});
