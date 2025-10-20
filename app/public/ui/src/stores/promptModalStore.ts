/**
 * Why: Coordinate prompt modal lifecycle so console workflows can request password, confirmation, or selection inputs.
 * What: Provides Zustand-backed helpers to open specific modal variants and resolve them with typed callbacks.
 * How: Stores the active configuration, exposes submit/cancel actions, and resets state after each interaction.
 */

import { create } from 'zustand';

export type PromptKind = 'password' | 'confirm' | 'select';

export interface BasePromptConfig {
  title: string;
  message: string;
  onSubmit?: (value: string | boolean) => void;
  onCancel?: () => void;
}

export interface PasswordPromptConfig extends BasePromptConfig {
  placeholder?: string;
  defaultValue?: string;
}

export interface ConfirmPromptConfig extends BasePromptConfig {
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface SelectPromptConfig extends BasePromptConfig {
  options: string[];
}

interface PromptModalState {
  isOpen: boolean;
  kind: PromptKind | null;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  options: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit?: (value: string | boolean) => void;
  onCancel?: () => void;
}

interface PromptModalActions {
  openPassword: (config: PasswordPromptConfig) => void;
  openConfirm: (config: ConfirmPromptConfig) => void;
  openSelect: (config: SelectPromptConfig) => void;
  submit: (value: string | boolean) => void;
  cancel: () => void;
  reset: () => void;
}

export type PromptModalStore = PromptModalState & PromptModalActions;

const INITIAL_STATE: PromptModalState = {
  isOpen: false,
  kind: null,
  title: '',
  message: '',
  placeholder: undefined,
  defaultValue: undefined,
  options: [],
  confirmLabel: undefined,
  cancelLabel: undefined,
  onSubmit: undefined,
  onCancel: undefined
};

export const usePromptModalStore = create<PromptModalStore>((set, get) => ({
  ...INITIAL_STATE,
  reset: () => set({ ...INITIAL_STATE }),
  openPassword: ({ title, message, placeholder, defaultValue, onSubmit, onCancel }) =>
    set({
      isOpen: true,
      kind: 'password',
      title,
      message,
      placeholder,
      defaultValue,
      options: [],
      confirmLabel: undefined,
      cancelLabel: undefined,
      onSubmit,
      onCancel
    }),
  openConfirm: ({ title, message, confirmLabel, cancelLabel, onSubmit, onCancel }) =>
    set({
      isOpen: true,
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel,
      placeholder: undefined,
      defaultValue: undefined,
      options: [],
      onSubmit,
      onCancel
    }),
  openSelect: ({ title, message, options, onSubmit, onCancel }) =>
    set({
      isOpen: true,
      kind: 'select',
      title,
      message,
      options,
      placeholder: undefined,
      defaultValue: undefined,
      confirmLabel: undefined,
      cancelLabel: undefined,
      onSubmit,
      onCancel
    }),
  submit: (value) => {
    const { onSubmit, reset } = get();
    try {
      onSubmit?.(value);
    } finally {
      reset();
    }
  },
  cancel: () => {
    const { onCancel, reset } = get();
    try {
      onCancel?.();
    } finally {
      reset();
    }
  }
}));
