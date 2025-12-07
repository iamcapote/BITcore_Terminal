/**
 * @license INTERNAL ONLY — Separator primitive
 *
 * Why: Provide consistent dividers across panels and menus.
 * What: Wrap Radix separator with default styles for horizontal/vertical orientation.
 * How: Forward refs and merge class names with cn helper.
 */

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Separator = forwardRef<
	React.ElementRef<typeof SeparatorPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
	<SeparatorPrimitive.Root
		ref={ref}
		decorative={decorative}
		orientation={orientation}
		className={cn(
			"shrink-0 bg-border",
			orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
			className,
		)}
		{...props}
	/>
));

Separator.displayName = SeparatorPrimitive.Root.displayName;

