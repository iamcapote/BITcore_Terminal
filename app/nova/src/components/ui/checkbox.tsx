/**
 * @license INTERNAL ONLY — Checkbox primitive
 *
 * Why: Keep form controls consistent across settings panels and inspector surfaces.
 * What: Radix checkbox wrapper with Tailwind theming and focus management.
 * How: Delegate to @radix-ui/react-checkbox while exposing the forward-ref component used by forms.
 */

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxPrimitive.CheckboxProps>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			"peer h-4 w-4 shrink-0 rounded border border-input bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
			<CheckIcon className="h-3 w-3" />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

