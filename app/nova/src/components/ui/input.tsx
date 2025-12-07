/**
 * @license INTERNAL ONLY — Input primitive
 *
 * Why: Provide consistent text inputs that match Nova's spacing, typography, and focus treatments.
 * What: Forward-ref input element with Tailwind classes for default, disabled, and invalid states.
 * How: Merge caller classes with defaults so surfaces can compose without duplicating tokens.
 */

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
	({ className, type = "text", ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				className={cn(
					"flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
					className,
				)}
				{...props}
			/>
		);
	},
);

Input.displayName = "Input";

