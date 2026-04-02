/**
 * @license INTERNAL ONLY — Tabs primitive
 *
 * Why: Coordinate view switches with consistent focus management.
 * What: Styled Radix tabs for list, trigger, and content components.
 * How: Forward refs and apply design tokens through cn helper.
 */

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn(
			"inline-flex h-10 items-center justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground",
			className,
		)}
		{...props}
	/>
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"inline-flex min-w-0 max-w-full items-center justify-center whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 sm:px-3 sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground",
			className,
		)}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn("mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

