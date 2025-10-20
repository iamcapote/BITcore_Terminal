/**
 * Why: Centralize shell orchestration so sidebar, command surface, and insight deck stay in sync with focus mode and responsive breakpoints.
 * What: Renders a three-region layout with optional sidebar/deck visibility toggles while delegating content rendering to callers.
 * How: Applies semantic regions with data attributes consumed by shell-layout.css to collapse chrome when focus mode is enabled.
 */

import type { ReactNode } from 'react';

export interface ShellLayoutProps {
	sidebar?: ReactNode;
	commandSurface: ReactNode;
	insightDeck?: ReactNode;
	isFocusMode?: boolean;
}

export function ShellLayout({ sidebar, commandSurface, insightDeck, isFocusMode = false }: ShellLayoutProps): JSX.Element {
	return (
		<div className="shell-layout" data-focus-mode={isFocusMode ? 'true' : 'false'}>
			{sidebar ? (
				<aside className="shell-layout__sidebar" aria-hidden={isFocusMode} aria-label="Primary navigation">
					{sidebar}
				</aside>
			) : null}
			<section className="shell-layout__command-surface" aria-label="Command surface">
				{commandSurface}
			</section>
			{insightDeck ? (
				<aside className="shell-layout__insight-deck" aria-hidden={isFocusMode} aria-label="Insight deck">
					{insightDeck}
				</aside>
			) : null}
		</div>
	);
}

export default ShellLayout;
