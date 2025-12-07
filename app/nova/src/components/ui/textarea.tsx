/**
 * @license INTERNAL ONLY — Textarea primitive
 *
 * Why: Extend form controls for draft commands and notes in Nova surfaces.
 * What: Forward-ref textarea with Nova focus states.
 * How: Merge class overrides and expose native textarea props.
 */

import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
	({ className, ...props }, ref) => (
		<textarea
			ref={ref}
			className={cn(
				"flex min-h-[96px] w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	),
);
Textarea.displayName = "Textarea";

