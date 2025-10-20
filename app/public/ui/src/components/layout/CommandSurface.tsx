/**
 * Why: Present the primary command window with consistent chrome regardless of skin or feature composition.
 * What: Wraps children in the shared Window primitive and exposes slots for title, subtitle, and toolbar.
 * How: Delegates actual content to callers while applying structural classes for layout CSS to target.
 */

import type { PropsWithChildren, ReactNode } from 'react';

import { Window } from '../primitives';

export interface CommandSurfaceProps extends PropsWithChildren {
  title: ReactNode;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
}

export function CommandSurface({ title, subtitle, toolbar, children }: CommandSurfaceProps): JSX.Element {
  return (
    <Window title={title} subtitle={subtitle} toolbar={toolbar}>
      <div className="command-surface__body">{children}</div>
    </Window>
  );
}

export default CommandSurface;
