/**
 * Why: Encapsulate panel styling for telemetry decks, mission cards, and modular UI sections.
 * What: Provides a token-aware container with optional header and footer slots.
 * How: Composes semantic sections rendered only when props are supplied while preserving flexible children layout.
 */

import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';

import { getThemeComponentOverride, registerThemeComponentOverride, useTheme } from '../../theme/ThemeProvider';

export interface CardProps extends PropsWithChildren {
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
}

function renderCardSurface(style: CSSProperties, { title, subtitle, footer, children }: CardProps): JSX.Element {
  return (
    <section style={style}>
      {(title || subtitle) && (
        <header>
          {title && <h3 style={{ margin: 0 }}>{title}</h3>}
          {subtitle && (
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-sm)' }}>{subtitle}</p>
          )}
        </header>
      )}
      <div>{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}

export function DefaultCard(props: CardProps): JSX.Element {
  const defaultSurface: CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radii-md)',
    padding: 'var(--spacing-xl)',
    backgroundColor: 'var(--color-bg-secondary)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)'
  };
  return renderCardSurface(defaultSurface, props);
}

function RetroCard(props: CardProps): JSX.Element {
  const retroSurface: CSSProperties = {
    borderRadius: 'var(--radii-sm)',
    border: '2px solid var(--panel-border-dark)',
    background: 'linear-gradient(180deg, var(--panel-gradient-top), var(--panel-gradient-bottom))',
    boxShadow:
      'inset 1px 1px 0 0 var(--panel-border-light), inset -1px -1px 0 0 var(--panel-border-shadow), 2px 2px 0 0 var(--panel-border-shadow)',
    padding: 'var(--spacing-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)'
  };
  return renderCardSurface(retroSurface, props);
}

function HackerCard(props: CardProps): JSX.Element {
  const hackerSurface: CSSProperties = {
    borderRadius: 'var(--radii-md)',
    border: '1px solid var(--hacker-card-border, rgba(20, 241, 255, 0.22))',
    padding: 'var(--spacing-lg)',
    background: 'var(--hacker-card-bg, rgba(6, 13, 24, 0.85))',
    boxShadow: 'var(--hacker-card-shadow, 0 24px 60px -48px rgba(20, 241, 255, 0.65))',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)'
  };
  return renderCardSurface(hackerSurface, props);
}

registerThemeComponentOverride('modern', 'card', DefaultCard);
registerThemeComponentOverride('retro', 'card', RetroCard);
registerThemeComponentOverride('hacker', 'card', HackerCard);

export function Card(props: CardProps): JSX.Element {
  const { theme } = useTheme();
  const override = getThemeComponentOverride(theme, 'card');
  const Renderer = override ?? DefaultCard;
  return <Renderer {...props} />;
}
