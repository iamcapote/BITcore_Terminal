/**
 * Why: Present password, confirmation, and selection prompts in a reusable modal while backend wiring evolves.
 * What: Observes the prompt modal store, renders variant-specific inputs, and routes submissions back to the store actions.
 * How: Applies token-aware inline styles, manages focus for inputs, and dispatches submit/cancel events per variant.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Input } from './primitives/Input';
import { usePromptModalStore } from '../stores/promptModalStore';

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--spacing-xl)',
  zIndex: 1001
};

const CONTAINER_STYLE: CSSProperties = {
  width: 'min(480px, 100%)',
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radii-lg)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-lg)',
  padding: 'var(--spacing-xl)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-lg)'
};

export function PromptModal(): JSX.Element | null {
  const { isOpen, kind, title, message, placeholder, defaultValue, options, confirmLabel, cancelLabel, submit, cancel } =
    usePromptModalStore();

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [passwordValue, setPasswordValue] = useState('');

  useEffect(() => {
    if (isOpen && kind === 'password') {
      setPasswordValue(defaultValue ?? '');
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }
  }, [defaultValue, isOpen, kind]);

  useEffect(() => {
    if (!isOpen) {
      setPasswordValue('');
    }
  }, [isOpen]);

  const header = useMemo(
    () => (
      <header>
        <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>{message}</p>
      </header>
    ),
    [message, title]
  );

  if (!isOpen || !kind) {
    return null;
  }

  const handleOverlayClick = () => {
    cancel();
  };

  const handleContainerClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  const handlePasswordSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    submit(passwordValue);
  };

  return (
    <div role="presentation" onClick={handleOverlayClick} onKeyDown={handleKeyDown} style={OVERLAY_STYLE}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={handleContainerClick} style={CONTAINER_STYLE}>
        {header}
        {kind === 'password' ? (
          <form
            onSubmit={handlePasswordSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)'
            }}
          >
            <Input
              ref={passwordInputRef}
              type="password"
              placeholder={placeholder ?? 'Enter value'}
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
              <button
                type="button"
                onClick={() => cancel()}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radii-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-fg-primary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radii-sm)',
                  border: '1px solid var(--color-accent-primary)',
                  background: 'var(--color-accent-primary)',
                  color: 'var(--color-bg-primary)',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </form>
        ) : null}
        {kind === 'confirm' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              onClick={() => cancel()}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radii-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-fg-primary)',
                cursor: 'pointer'
              }}
            >
              {cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radii-sm)',
                border: '1px solid var(--color-accent-primary)',
                background: 'var(--color-accent-primary)',
                color: 'var(--color-bg-primary)',
                cursor: 'pointer'
              }}
            >
              {confirmLabel ?? 'Confirm'}
            </button>
          </div>
        ) : null}
        {kind === 'select' ? (
          <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => submit(option)}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radii-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-fg-primary)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={() => cancel()}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-muted)',
                textDecoration: 'underline',
                justifySelf: 'flex-start',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
