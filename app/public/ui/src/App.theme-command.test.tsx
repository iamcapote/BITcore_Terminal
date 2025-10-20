import { describe, expect, it, vi } from 'vitest';

import { runConfigSetThemeCommand } from './controllers/runConfigSetThemeCommand';
import type { SelectPromptConfig } from './stores/promptModalStore';

describe('runConfigSetThemeCommand', () => {
  it('opens a select prompt and applies valid themes', () => {
    const themes = ['hacker', 'modern', 'retro'] as const;
  const setTheme = vi.fn();
  const appendEntry = vi.fn();
  let capturedConfig: SelectPromptConfig | null = null;

    runConfigSetThemeCommand({
      themes,
      setTheme,
      appendEntry,
      openSelect: (config) => {
        capturedConfig = config;
      }
    });

    expect(capturedConfig).not.toBeNull();
    if (!capturedConfig) {
      throw new Error('Expected select config to be captured.');
    }
    const config: SelectPromptConfig = capturedConfig;
    expect(config.title).toBe('Select theme');
    expect(config.options).toEqual(['hacker', 'modern', 'retro']);

    config.onSubmit?.('retro');
    expect(setTheme).toHaveBeenCalledWith('retro');
    expect(appendEntry).toHaveBeenCalledWith({ text: 'Config updated: ui.theme set to retro.', type: 'system' });

    appendEntry.mockReset();
    config.onSubmit?.('invalid');
    expect(appendEntry).toHaveBeenCalledWith({
      text: 'Config update failed: theme "invalid" not recognized.',
      type: 'system'
    });

    appendEntry.mockReset();
    config.onCancel?.();
    expect(appendEntry).toHaveBeenCalledWith({ text: 'Theme update via /config cancelled.', type: 'system' });
  });
});
