/**
 * @license INTERNAL ONLY — Badge primitive
 *
 * Why: Display compact status indicators with consistent styling across shells and panels.
 * What: Tailwind-variant aware span that supports default, secondary, outline, ghost, and destructive appearances.
 * How: Wrap a span with class-variance-authority so surfaces can toggle variants without bespoke CSS.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground shadow",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				outline: "text-foreground",
				ghost: "border-transparent bg-muted/40 text-muted-foreground",
				destructive: "border-transparent bg-destructive text-destructive-foreground shadow",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => (
	<div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));

Badge.displayName = "Badge";

