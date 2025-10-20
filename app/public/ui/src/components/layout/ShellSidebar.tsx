/**
 * Why: Provide a structured container for shell sidebar content so navigation, quick actions, and context copy reuse consistent styling.
 * What: Wraps header, action buttons, meta details, and arbitrary children with classes consumed by the shell layout stylesheet.
 * How: Accepts simple React nodes for sections, renders them in order, and leaves business logic to the parent surface.
 */

import type { PropsWithChildren, ReactNode } from 'react';

export interface ShellSidebarProps extends PropsWithChildren {
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	meta?: ReactNode;
	footer?: ReactNode;
}

export function ShellSidebar({ title, description, actions, meta, footer, children }: ShellSidebarProps): JSX.Element {
	return (
		<div className="shell-sidebar">
			{(title || description) && (
				<header className="shell-sidebar__header">
					{title ? <h1 className="shell-sidebar__title">{title}</h1> : null}
					{description ? <p className="shell-sidebar__description">{description}</p> : null}
				</header>
			)}
			{actions ? <div className="shell-sidebar__actions">{actions}</div> : null}
			{children}
			{meta ? <div className="shell-sidebar__meta">{meta}</div> : null}
			{footer}
		</div>
	);
}

export default ShellSidebar;
