/**
 * Why: Centralize command palette visibility and query state so keyboard shortcuts and UI controls stay in sync.
 * What: Lightweight Zustand store that exposes open/close helpers alongside the current search query.
 * How: Provides composable actions for React components while leaving result selection to local component state.
 */

import { create } from 'zustand';

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
}

interface CommandPaletteActions {
  open: () => void;
  close: () => void;
  setQuery: (value: string) => void;
  openWithQuery: (value: string) => void;
}

export type CommandPaletteStore = CommandPaletteState & CommandPaletteActions;

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  query: '',
  open: () => set({ isOpen: true, query: '' }),
  close: () => set({ isOpen: false, query: '' }),
  setQuery: (value) => set({ query: value }),
  openWithQuery: (value) => set({ isOpen: true, query: value })
}));
