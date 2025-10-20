/**
 * Why: Centralize terminal session state so console, command palette, and telemetry share a cohesive source of truth.
 * What: Exposes a Zustand store that tracks history entries, input state, prompt metadata, and mode transitions.
 * How: Provides immutable helpers to append lines, toggle input availability, and reset the console for reuse across skins.
 */

import { create } from 'zustand';

export type TerminalMode = 'command' | 'chat' | 'research' | 'prompt';
export type TerminalEntryType = 'input' | 'output' | 'system';

export interface TerminalEntry {
  id: string;
  type: TerminalEntryType;
  text: string;
  createdAt: number;
}

export interface TerminalState {
  mode: TerminalMode;
  prompt: string;
  input: string;
  inputDisabled: boolean;
  history: TerminalEntry[];
}

export interface TerminalActions {
  setMode: (mode: TerminalMode) => void;
  setPrompt: (prompt: string) => void;
  setInput: (value: string) => void;
  appendEntry: (entry: Omit<TerminalEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
  clearHistory: () => void;
  disableInput: () => void;
  enableInput: () => void;
  reset: () => void;
}

export type TerminalStore = TerminalState & TerminalActions;

const INITIAL_STATE: TerminalState = Object.freeze({
  mode: 'command',
  prompt: '▶ ',
  input: '',
  inputDisabled: false,
  history: []
});

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  ...INITIAL_STATE,
  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt }),
  setInput: (value) => set({ input: value }),
  appendEntry: (entry) =>
    set(({ history }) => ({
      history: [...history, { id: entry.id ?? createId(), createdAt: entry.createdAt ?? Date.now(), text: entry.text, type: entry.type }]
    })),
  clearHistory: () => set({ history: [] }),
  disableInput: () => set({ inputDisabled: true }),
  enableInput: () => set({ inputDisabled: false }),
  reset: () => set({ ...INITIAL_STATE })
}));

export function getTerminalSnapshot(): TerminalState {
  const { mode, prompt, input, inputDisabled, history } = useTerminalStore.getState();
  return {
    mode,
    prompt,
    input,
    inputDisabled,
    history: [...history]
  };
}
