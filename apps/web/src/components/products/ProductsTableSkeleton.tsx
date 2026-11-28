'use client';

/** Loading skeleton shaped like the products/inventory table (~6 rows, 72px tall). */
export function ProductsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex min-h-[72px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 sm:px-5"
        >
          <span className="size-10 shrink-0 animate-pulse rounded-ws-control bg-draft-tint" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-4 w-2/3 max-w-52 animate-pulse rounded bg-draft-tint" />
            <span className="h-3 w-24 animate-pulse rounded bg-canvas" />
          </span>
          <span className="hidden h-4 w-20 animate-pulse rounded bg-draft-tint md:block" />
          <span className="hidden h-4 w-24 animate-pulse rounded bg-draft-tint sm:block" />
          <span className="h-6 w-20 animate-pulse rounded-full bg-draft-tint" />
          <span className="hidden h-8 w-24 animate-pulse rounded-ws-control bg-canvas lg:block" />
        </div>
      ))}
    </div>
  );
}
