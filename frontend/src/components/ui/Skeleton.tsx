import { cn } from '../../lib/utils';

/**
 * Shimmering placeholder shown while data loads.
 */
export function Skeleton({ className }: { className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700', className)}
    />
  );
}

/**
 * A stack of table-row-shaped skeletons.
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }): JSX.Element {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
