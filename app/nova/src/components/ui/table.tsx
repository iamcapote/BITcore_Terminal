/**
 * @license INTERNAL ONLY — Table primitives
 *
 * Why: Render tabular data with consistent typography and spacing.
 * What: Semantic table wrappers that add Tailwind classes for headers, rows, and cells.
 * How: Forward refs for each element to keep composition flexible.
 */

import type * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Table = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
	<div className="relative w-full overflow-auto">
		<table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
	</div>
));
Table.displayName = "Table";

export const TableHeader = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
	({ className, ...props }, ref) => <thead ref={ref} className={cn("bg-muted text-muted-foreground", className)} {...props} />, 
);
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
	({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />, 
);
TableBody.displayName = "TableBody";

export const TableFooter = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
	({ className, ...props }, ref) => (
		<tfoot ref={ref} className={cn("bg-muted/50 font-medium text-muted-foreground", className)} {...props} />
	),
);
TableFooter.displayName = "TableFooter";

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
	({ className, ...props }, ref) => (
		<tr
			ref={ref}
			className={cn(
				"border-b border-border/60 transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		/>
	),
);
TableRow.displayName = "TableRow";

export const TableHead = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
	({ className, ...props }, ref) => (
		<th
			ref={ref}
			className={cn(
				"h-10 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground",
				className,
			)}
			{...props}
		/>
	),
);
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
	({ className, ...props }, ref) => (
		<td ref={ref} className={cn("p-4 align-middle", className)} {...props} />
	),
);
TableCell.displayName = "TableCell";

export const TableCaption = forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
	({ className, ...props }, ref) => (
		<caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
	),
);
TableCaption.displayName = "TableCaption";

