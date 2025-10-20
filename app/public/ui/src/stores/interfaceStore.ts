/**
 * Why: Centralize cross-cutting UI flags so command palette and layout shells remain synchronized.
 * What: Provides a Zustand store that exposes focus mode state and helpers to enter, exit, or toggle it.
 * How: Stores a minimal boolean flag and pure actions to keep the layout responsive without prop-drilling.
 */

import { create } from 'zustand';

interface InterfaceState {
  isFocusMode: boolean;
  isSettingsOpen: boolean;
}

interface InterfaceActions {
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  toggleFocusMode: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
}

export type InterfaceStore = InterfaceState & InterfaceActions;

const INITIAL_STATE: InterfaceState = Object.freeze({
  isFocusMode: false,
  isSettingsOpen: false
});

export const useInterfaceStore = create<InterfaceStore>((set, get) => ({
  ...INITIAL_STATE,
  enterFocusMode: () => set({ isFocusMode: true }),
  exitFocusMode: () => set({ isFocusMode: false }),
  toggleFocusMode: () => set({ isFocusMode: !get().isFocusMode }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSettings: () => set({ isSettingsOpen: !get().isSettingsOpen })
}));

export function getInterfaceSnapshot(): InterfaceState {
  const { isFocusMode, isSettingsOpen } = useInterfaceStore.getState();
  return { isFocusMode, isSettingsOpen };
}
