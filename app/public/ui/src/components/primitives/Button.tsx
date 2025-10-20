/**
 * Why: Supply a reusable token-aware button primitive for CLI and GUI parity stories.
 * What: Implements semantic variants (solid, outline, ghost) with primary/secondary/danger intents.
 * How: Renders a forwardRef button that composes inline styles derived from the active theme.
 */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

const INTENT_COLORS = {
  primary: {
    bg: 'var(--color-accent-primary)',
    fg: 'var(--color-bg-primary)'
  },
  secondary: {
    bg: 'var(--color-bg-secondary)',
    fg: 'var(--color-fg-primary)'
  },
  danger: {
    bg: 'var(--color-danger)',
    fg: 'var(--color-bg-primary)'
  }
} as const;

export type ButtonIntent = keyof typeof INTENT_COLORS;
export type ButtonVariant = 'solid' | 'outline' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = 'primary', variant = 'solid', style, ...rest },
  ref
) {
  const palette = INTENT_COLORS[intent];
  const baseStyle: CSSProperties = {
    borderRadius: 'var(--radii-sm)',
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    fontFamily: 'var(--typography-font-family-mono)',
    fontSize: 'var(--typography-font-size-sm)',
    cursor: 'pointer',
    transition: 'background-color var(--motion-transition-fast), color var(--motion-transition-fast)',
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)'
  };

  if (variant === 'solid') {
    baseStyle.backgroundColor = palette.bg;
    baseStyle.color = palette.fg;
  } else if (variant === 'outline') {
    baseStyle.backgroundColor = 'transparent';
    baseStyle.color = palette.bg;
    baseStyle.border = `1px solid ${palette.bg}`;
  } else {
    baseStyle.backgroundColor = 'transparent';
    baseStyle.color = palette.bg;
    baseStyle.border = '1px solid transparent';
  }

  return <button ref={ref} style={{ ...baseStyle, ...style }} {...rest} />;
});
