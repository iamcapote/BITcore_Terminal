/**
 * Why: Centralize the `/config set ui.theme` flow so App and future surfaces share identical behavior.
 * What: Exposes a pure helper that wires the select prompt, validates the selection, and logs terminal feedback.
 * How: Receives theme metadata, prompt modal opener, and terminal logger; issues callbacks without touching React state.
 *
 * Contract
 * Inputs:
 *   - deps.themes: readonly ThemeName[]; valid theme identifiers exposed to operators.
 *   - deps.setTheme: (theme: ThemeName) => void; updates the active ThemeProvider skin.
 *   - deps.openSelect: PromptModalStore['openSelect']; opens the select prompt for theme choice.
 *   - deps.appendEntry: TerminalStore['appendEntry']; records system feedback in the terminal history.
 * Outputs:
 *   - void; side effects routed through provided callbacks only.
 * Error modes:
 *   - Invalid selection surfaces a system entry describing the rejected theme; no exceptions thrown.
 * Performance:
 *   - time: O(n) to clone the themes array; memory: O(n) for prompt options duplication (n = theme count).
 * Side effects:
 *   - Invokes openSelect to display prompt and appendEntry to log outcomes.
 */

import type { PromptModalStore } from '../stores/promptModalStore';
import type { TerminalStore } from '../stores/terminalStore';
import type { ThemeName } from '../theme/ThemeProvider';

export interface RunConfigSetThemeDeps {
  themes: readonly ThemeName[];
  setTheme: (theme: ThemeName) => void;
  openSelect: PromptModalStore['openSelect'];
  appendEntry: TerminalStore['appendEntry'];
}

export function runConfigSetThemeCommand({ themes, setTheme, openSelect, appendEntry }: RunConfigSetThemeDeps): void {
  const themeOptions = [...themes];

  openSelect({
    title: 'Select theme',
    message: 'Choose which skin to apply. This mirrors `/config set ui.theme` from the CLI.',
    options: themeOptions,
    onSubmit: (selection) => {
      if (typeof selection === 'string' && themeOptions.includes(selection as ThemeName)) {
        const nextTheme = selection as ThemeName;
        setTheme(nextTheme);
        appendEntry({ text: `Config updated: ui.theme set to ${nextTheme}.`, type: 'system' });
        return;
      }

      appendEntry({ text: `Config update failed: theme "${String(selection)}" not recognized.`, type: 'system' });
    },
    onCancel: () => {
      appendEntry({ text: 'Theme update via /config cancelled.', type: 'system' });
    }
  });
}
