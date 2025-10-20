/**
 * Why: Centralize operator preferences such as theme selection inside a dedicated settings drawer.
 * What: Renders a right-aligned overlay with theme controls powered by the ThemeProvider contract.
 * How: Observes the interface store for open state, lists available themes, and wires selection to the setTheme helper while keeping the drawer visible for additional tweaks.
 * Contract
 * Inputs:
 *   - none (reads interface and theme context stores)
 * Outputs:
 *   - Drawer markup when open; returns null when closed
 * Error modes:
 *   - none; pure render
 * Performance:
 *   - negligible; renders a handful of static buttons
 * Side effects:
 *   - Updates ThemeProvider state and localStorage when selecting a theme
 */

import { memo, useMemo } from 'react';

import { listAvailableThemes, useTheme } from '../theme/ThemeProvider';
import { useInterfaceStore } from '../stores/interfaceStore';

export const SettingsDrawer = memo(function SettingsDrawer(): JSX.Element | null {
  const isOpen = useInterfaceStore((state) => state.isSettingsOpen);
  const closeSettings = useInterfaceStore((state) => state.closeSettings);
  const { theme, setTheme } = useTheme();

  const themes = useMemo(() => listAvailableThemes(), []);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = () => {
    closeSettings();
  };

  const handleDrawerClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      role="presentation"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
        padding: 'var(--spacing-xl)',
        zIndex: 1002
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={handleDrawerClick}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radii-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xl)'
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Settings</h2>
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>
              Preferences sync across the web UI and CLI surfaces.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--typography-font-family-mono)',
              fontSize: 'var(--typography-font-size-sm)'
            }}
          >
            Close
          </button>
        </header>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <h3 style={{ margin: 0 }}>Theme</h3>
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)' }}>
              Choose the active skin or run <code>/config set ui.theme</code> from the console.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {themes.map((themeName) => {
              const isActive = themeName === theme;
              return (
                <button
                  key={themeName}
                  type="button"
                  onClick={() => setTheme(themeName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderRadius: 'var(--radii-md)',
                    border: isActive ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                    background: isActive
                      ? 'color-mix(in srgb, var(--color-accent-primary) 18%, transparent)'
                      : 'var(--color-bg-secondary)',
                    color: 'var(--color-fg-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{themeName}</span>
                  {isActive ? (
                    <span style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-font-size-xs)' }}>
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
});
