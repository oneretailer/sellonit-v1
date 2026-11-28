'use client';

import Link from 'next/link';
import { DashboardIcon, type DashboardIconName } from '@/components/dashboard/icons';
import { cn } from '@/lib/cn';

/** Compact metric card: small label top-left, small line icon top-right, big stat number, grey caption or orange review link. */
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
  const iconTone =
    tone === 'orange' ? 'text-primary' : tone === 'red' ? 'text-danger' : 'text-subtle';
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[length:var(--text-ws-label)] font-medium text-subtle">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-ws-control',
            iconTone,
          )}
        >
          <DashboardIcon name={icon} className="size-[18px]" />
        </span>
      </div>
      {isLoading ? (
        <span className="block h-9 w-20 animate-pulse rounded-ws-control bg-draft-tint" />
      ) : (
        <p className="font-heading text-[length:var(--text-ws-stat)] font-semibold leading-tight text-ink">
          {value}
        </p>
      )}
      {isLoading ? (
        <span className="block h-4 w-36 animate-pulse rounded bg-canvas" />
      ) : subline ? (
        <p className="truncate text-[length:var(--text-ws-caption)] text-caption">{subline}</p>
      ) : href ? (
        <Link
          href={href}
          className="inline-flex min-h-6 w-fit items-center gap-1 text-[length:var(--text-ws-caption)] font-medium text-primary hover:underline underline-offset-2"
        >
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}
