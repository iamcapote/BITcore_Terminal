/**
 * Why: Unify keyboard-first workflows so the command palette and focus mode behave consistently across components.
 * What: Attaches guarded window listeners that map canonical shortcut chords to Zustand store actions.
 * How: Subscribes on mount, ignores text inputs to avoid disruption, and toggles palette visibility or focus mode state.
 *
 * Contract
 * Inputs:
 *   - None; hook reads from global keyboard events and bounded Zustand stores.
 * Outputs:
 *   - Registers window-level listeners that drive command palette visibility and focus mode state.
 * Error modes:
 *   - None; defensive guards ensure events from form fields are ignored to avoid user disruption.
 * Performance:
 *   - time: negligible (<1ms per keydown), memory: constant.
 * Side effects:
 *   - Subscribes to `window` keydown events; toggles Zustand store state changes.
 */

import { useEffect } from 'react';

import { useCommandPaletteStore } from '../stores/commandPaletteStore';
import { useInterfaceStore } from '../stores/interfaceStore';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA']);

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (INPUT_TAGS.has(target.tagName)) {
    const element = target as HTMLInputElement | HTMLTextAreaElement;
    const type = 'type' in element ? element.type : 'text';

    if (!['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) {
      return true;
    }
  }

  return false;
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
  const { open: openPalette } = useCommandPaletteStore.getState();
  const { toggleFocusMode, exitFocusMode, openSettings } = useInterfaceStore.getState();

    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target ?? null;

      const isCommandPaletteShortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k';
      if (isCommandPaletteShortcut) {
        if (shouldIgnoreTarget(target)) {
          return;
        }
        event.preventDefault();
        openPalette();
        return;
      }

      const isFocusToggleShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f';
      if (isFocusToggleShortcut) {
        if (shouldIgnoreTarget(target)) {
          return;
        }
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      const isSettingsShortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === ',';
      if (isSettingsShortcut) {
        if (shouldIgnoreTarget(target)) {
          return;
        }
        event.preventDefault();
        openSettings();
        return;
      }

      if (event.key === 'Escape') {
        if (useInterfaceStore.getState().isFocusMode) {
          exitFocusMode();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
