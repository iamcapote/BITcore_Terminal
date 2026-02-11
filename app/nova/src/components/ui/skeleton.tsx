/**
 * Why: Skeleton loading placeholder for async content.
 * What: Animated pulse rectangle matching shadcn/ui convention.
 * How: Simple div with animate-pulse and rounded corners.
 */

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
