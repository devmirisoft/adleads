import { Skeleton } from '@/modules/core/components';

/** Shown while any admin page loads: header + filter row + table rows. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
