/* @vitest-environment jsdom */
/**
 * Why: Ensure themed component overrides apply the correct chrome for card primitives across skins.
 * What: Mounts the Card within a ThemeProvider, switches the active theme, and asserts style changes on the rendered surface.
 * How: Uses a helper component to call setTheme during layout effect and inspects the section element backing the card.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';

import { Card } from './Card';
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider';

function CardWithTheme({ theme }: { theme: 'hacker' | 'modern' | 'retro' }): JSX.Element {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  return (
    <Card title="Example" subtitle="Preview">
      <p>Body</p>
    </Card>
  );
}

describe('Card theme overrides', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  it('renders retro chrome for the retro theme', () => {
    render(
      <ThemeProvider>
        <CardWithTheme theme="retro" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Example' });
  const surface = heading.closest('section') as HTMLElement | null;
  expect(surface).not.toBeNull();
  expect(surface?.style.border).toBe('2px solid var(--panel-border-dark)');
  expect(surface?.style.background).toBe('linear-gradient(180deg, var(--panel-gradient-top), var(--panel-gradient-bottom))');
  });

  it('renders hacker chrome for the hacker theme', () => {
    render(
      <ThemeProvider>
        <CardWithTheme theme="hacker" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Example' });
  const surface = heading.closest('section') as HTMLElement | null;
  expect(surface).not.toBeNull();
  expect(surface?.style.background).toBe('var(--hacker-card-bg, rgba(6, 13, 24, 0.85))');
  expect(surface?.style.boxShadow).toBe('var(--hacker-card-shadow, 0 24px 60px -48px rgba(20, 241, 255, 0.65))');
  });

  it('falls back to the modern style by default', () => {
    render(
      <ThemeProvider>
        <CardWithTheme theme="modern" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Example' });
  const surface = heading.closest('section') as HTMLElement | null;
  expect(surface).not.toBeNull();
  expect(surface?.style.border).toBe('1px solid var(--color-border)');
  expect(surface?.style.backgroundColor).toBe('var(--color-bg-secondary)');
  });
});
