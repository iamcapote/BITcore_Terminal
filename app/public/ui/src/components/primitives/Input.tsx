/**
 * Why: Offer a consistent input primitive that mirrors command palette and form controls across skins.
 * What: Wraps a native input with token-driven styling and focus treatment.
 * How: Forwards refs for form libraries while merging caller styles with sensible defaults.
 */

import { forwardRef, type CSSProperties, type FocusEvent, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { style, onFocus, onBlur, ...rest },
  ref
) {
  const baseStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radii-sm)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-fg-primary)',
    fontFamily: 'var(--typography-font-family-mono)',
    fontSize: 'var(--typography-font-size-sm)',
    outline: 'none',
    transition: 'border-color var(--motion-transition-fast), box-shadow var(--motion-transition-fast)'
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, var(--color-focus-ring) 30%, transparent)`;
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.style.boxShadow = '';
    onBlur?.(event);
  };

  return (
    <input
      ref={ref}
      style={{ ...baseStyle, ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    />
  );
});
