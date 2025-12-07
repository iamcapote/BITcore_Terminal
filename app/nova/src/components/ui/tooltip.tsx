/**
 * @license INTERNAL ONLY — Tooltip primitives
 *
 * Why: Provide accessible hover/focus affordances that mirror vendor parity.
 * What: Wrap Radix tooltip pieces with Nova styling tokens.
 * How: Forward refs, render through Radix portals, and merge class overrides via cn.
 */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				"z-50 overflow-hidden rounded-lg border border-border/70 bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg",
				"data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out",
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

