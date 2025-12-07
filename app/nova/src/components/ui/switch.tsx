/**
 * @license INTERNAL ONLY — Switch primitive
 *
 * Why: Toggle boolean settings with a11y-compliant control.
 * What: Styled Radix switch with motionless transitions.
 * How: Forward refs and merge classes for root and thumb.
 */

import * as SwitchPrimitives from "@radix-ui/react-switch";
import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitives.Root
		ref={ref}
		className={cn(
			"peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary",
			className,
		)}
		{...props}
	>
		<SwitchPrimitives.Thumb
			className={cn(
				"pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
			)}
		/>
	</SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

