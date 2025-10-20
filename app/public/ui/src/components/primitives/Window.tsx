/**
 * Why: Provide a shared windowing primitive so themed shells can customize chrome without duplicating layout code.
 * What: Renders an outer surface with optional header, subtitle, toolbar, and footer slots while delegating styling to skin overrides.
 * How: Looks up a theme-specific component override; if none is registered falls back to a neutral container skeleton.
 */

import type { PropsWithChildren, ReactNode } from 'react';

import type { CSSProperties } from 'react';

import { getThemeComponentOverride, registerThemeComponentOverride, useTheme } from '../../theme/ThemeProvider';

export interface WindowProps extends PropsWithChildren {
  title?: ReactNode;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
}

function renderWindowStructure(
  style: CSSProperties,
  { title, subtitle, toolbar, footer, children }: WindowProps,
  headerStyle?: CSSProperties
): JSX.Element {
  return (
    <section style={style}>
      {(title || subtitle || toolbar) && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: toolbar ? 'flex-start' : 'center',
            gap: 'var(--spacing-md)',
            ...headerStyle
          }}
        >
          <div>
            {title && <h2 style={{ margin: 0 }}>{title}</h2>}
            {subtitle && (
              <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>{subtitle}</p>
            )}
          </div>
          {toolbar && <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>{toolbar}</div>}
        </header>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}

export function DefaultWindow(props: WindowProps): JSX.Element {
  const style: CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radii-lg)',
    padding: 'var(--spacing-xl)',
    background: 'var(--color-bg-secondary)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-lg)',
    height: '100%'
  };
  return renderWindowStructure(style, props);
}

function RetroWindow(props: WindowProps): JSX.Element {
  const style: CSSProperties = {
    border: '2px solid var(--panel-border-dark)',
    borderRadius: 'var(--radii-sm)',
    padding: 'var(--spacing-lg)',
    boxShadow:
      'inset 1px 1px 0 0 var(--panel-border-light), inset -1px -1px 0 0 var(--panel-border-shadow), 3px 3px 0 0 var(--panel-border-shadow)',
    background: 'linear-gradient(180deg, var(--panel-gradient-top), var(--panel-gradient-bottom))',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-lg)',
    height: '100%'
  };
  return renderWindowStructure(style, props);
}

function HackerWindow(props: WindowProps): JSX.Element {
  const style: CSSProperties = {
    border: '1px solid var(--terminal-border, rgba(20, 241, 255, 0.28))',
    borderRadius: 'var(--radii-lg)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--terminal-shadow, var(--shadow-lg))',
    background: 'var(--terminal-grid-overlay, transparent), var(--terminal-bg, var(--color-bg-secondary))',
    backgroundBlendMode: 'screen',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-lg)',
    height: '100%',
    overflow: 'hidden'
  };
  return renderWindowStructure(style, props);
}

registerThemeComponentOverride('modern', 'window', DefaultWindow);
registerThemeComponentOverride('retro', 'window', RetroWindow);
registerThemeComponentOverride('hacker', 'window', HackerWindow);

export function Window(props: WindowProps): JSX.Element {
  const { theme } = useTheme();
  const override = getThemeComponentOverride(theme, 'window');
  if (override) {
    return override(props);
  }
  return <DefaultWindow {...props} />;
}
