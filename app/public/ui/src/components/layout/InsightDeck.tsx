/**
 * Why: Arrange telemetry and mission panels in a token-aware grid that adapts to available space.
 * What: Provides a simple grid container plus a helper section component for full-width spans inside the deck.
 * How: Applies CSS classes defined in shell-layout.css, letting skins override presentation without touching layout logic.
 */

import type { PropsWithChildren } from 'react';

export interface InsightDeckProps extends PropsWithChildren {}

export interface InsightDeckSectionProps extends PropsWithChildren {
  span?: 'auto' | 'full';
}

export function InsightDeckSection({ span = 'auto', children }: InsightDeckSectionProps): JSX.Element {
  const className = span === 'full' ? 'insight-deck__section insight-deck__section--span-full' : 'insight-deck__section';
  return <div className={className}>{children}</div>;
}

interface InsightDeckComponent {
  (props: InsightDeckProps): JSX.Element;
  Section: (props: InsightDeckSectionProps) => JSX.Element;
}

const InsightDeckRoot: InsightDeckComponent = ({ children }) => <div className="insight-deck">{children}</div>;

InsightDeckRoot.Section = InsightDeckSection;

export const InsightDeck = InsightDeckRoot;

export default InsightDeck;
