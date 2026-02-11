/**
 * Why: Barrel re-export for backward compatibility after splitting knowledge surfaces.
 * What: Re-exports VectorManagerSurface, DatabaseManagerSurface, MemoryManagerSurface, MetricsBoardSurface.
 * How: Delegates to individual surface files; will be removed once all imports migrate.
 */

export { VectorManagerSurface } from "@/modules/views/VectorManagerSurface";
export { DatabaseManagerSurface } from "@/modules/views/DatabaseManagerSurface";
export { MemoryManagerSurface } from "@/modules/views/MemoryManagerSurface";
export { MetricsBoardSurface } from "@/modules/views/MetricsBoardSurface";
