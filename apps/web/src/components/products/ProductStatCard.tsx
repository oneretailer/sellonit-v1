'use client';

import Link from 'next/link';
import { DashboardIcon, type DashboardIconName } from '@/components/dashboard/icons';
import { cn } from '@/lib/cn';

/** Compact metric card: label + icon tile, big value, sub-line, review link. */
export function ProductStatCard({
  label,
  value,
  subline,
  icon,
  tone = 'gray',
  href,
  linkLabel = 'Review in inventory',
  isLoading = false,
}: {
  label: string;
  value: number | string;
  subline?: string;
  icon: DashboardIconName;
  tone?: 'gray' | 'orange' | 'red';
  href?: string;
  linkLabel?: string;
  isLoading?: boolean;
}) {
  const tile = tone === 'orange' ? 'bg-orange-50 text-primary' : tone === 'red' ? 'bg-red-50 text-danger' : 'bg-gray-100 text-subtle';
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-subtle">{label}</p>
        <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tile)}>
          <DashboardIcon name={icon} className="size-5" />
        </span>
      </div>
      {isLoading ? (
        <span className="block h-9 w-16 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <p className="font-heading text-3xl font-semibold text-ink">{value}</p>
      )}
      {subline ? <p className="truncate text-xs text-subtle">{subline}</p> : null}
      {href ? (
        <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2">
          {linkLabel} <DashboardIcon name="arrow" className="size-3.5" />
        </Link>
      ) : null}
    </section>
  );
}
