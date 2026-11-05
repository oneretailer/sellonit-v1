'use client';

/** Loading skeleton shaped like the products table (~7 rows). */
export function ProductsTableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
          <span className="size-12 shrink-0 animate-pulse rounded-xl bg-gray-100" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-4 w-2/3 max-w-52 animate-pulse rounded bg-gray-100" />
            <span className="h-3 w-24 animate-pulse rounded bg-gray-50" />
          </span>
          <span className="hidden h-4 w-20 animate-pulse rounded bg-gray-100 md:block" />
          <span className="hidden h-4 w-24 animate-pulse rounded bg-gray-100 sm:block" />
          <span className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
          <span className="hidden h-8 w-24 animate-pulse rounded-lg bg-gray-50 lg:block" />
        </div>
      ))}
    </div>
  );
}
