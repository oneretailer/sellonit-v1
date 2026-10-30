'use client';

import { useEffect, useState } from 'react';
import { notFound, usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import type { AuthUser } from '@/lib/auth/types';
import { roleForBusinessType } from '@/lib/onboarding/roleApi';
import { isSupplierRole } from '@/lib/onboarding/roles';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import { useSupplierDashboard } from '@/lib/dashboard/useSupplierDashboard';
import { getDateRangeOptions, type DateRangeOption } from '@/lib/dashboard/dateRanges';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { DashboardShell } from './DashboardShell';
import { SupplierDashboardOverview } from './SupplierDashboardOverview';

export type DashboardRouteMode = 'overview' | 'section';

function DashboardSessionSkeleton({
  displayName,
  onRetry,
}: {
  displayName: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen bg-white" aria-busy="true">
      <header className="flex h-22 items-center justify-between border-b border-line px-4 md:px-6 xl:px-8">
        <span className="block h-7 w-32 animate-pulse rounded bg-gray-100" />
        <div className="flex items-center gap-3">
          {displayName ? (
            <span className="hidden text-sm text-subtle md:block">{displayName}</span>
          ) : null}
          <span className="size-11 animate-pulse rounded-full bg-gray-100" />
          <span className="size-11 animate-pulse rounded-full bg-gray-100" />
        </div>
      </header>
      <div className="flex min-h-[990px]">
        <aside className="hidden w-[250px] border-r border-line p-6 lg:block">
          <span className="block h-4 w-40 animate-pulse rounded bg-gray-100" />
          <span className="mt-6 block h-24 w-full animate-pulse rounded-2xl bg-orange-50" />
          <div className="mt-8 flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="h-10 animate-pulse rounded-xl bg-gray-50" />
            ))}
          </div>
        </aside>
        <main className="mx-auto w-full max-w-screen-2xl min-w-0 p-4 md:p-7">
          <span
            role="status"
            aria-label="Loading workspace"
            className="block h-9 w-56 animate-pulse rounded bg-gray-100"
          />
          <div className="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="h-32 animate-pulse rounded-3xl bg-gray-50" />
            ))}
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <span className="h-72 animate-pulse rounded-3xl bg-gray-50 xl:col-span-2" />
            <span className="h-72 animate-pulse rounded-3xl bg-gray-50" />
          </div>
        </main>
      </div>
      {onRetry ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-2xl border border-line bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm text-subtle">
            We couldn&apos;t verify your session. Try again.
          </p>
          <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}

function OverviewWorkspace({ user }: { user: AuthUser }) {
  const [options] = useState<DateRangeOption[]>(() => getDateRangeOptions());
  const [selected, setSelected] = useState<DateRangeOption>(() => options[0]!);
  const dashboard = useSupplierDashboard(selected.range);
  return (
    <DashboardShell user={user} data={dashboard.data} activePath="/dashboard/overview">
      <SupplierDashboardOverview
        user={user}
        data={dashboard.data}
        isLoading={dashboard.isLoading}
        error={dashboard.error}
        retry={dashboard.retry}
        selectedRange={selected}
        rangeOptions={options}
        onRangeChange={setSelected}
      />
    </DashboardShell>
  );
}

function PlaceholderWorkspace({ user, pathname }: { user: AuthUser; pathname: string }) {
  const itemName = pathname
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return (
    <DashboardShell user={user} data={EMPTY_SUPPLIER_DASHBOARD} activePath={pathname}>
      <section className="rounded-3xl border border-line bg-white p-6 text-center shadow-sm md:p-8">
        <h1 className="font-heading text-2xl font-semibold text-ink md:text-[28px]">
          This section is coming soon
        </h1>
        <p className="mt-3 text-sm text-subtle md:text-base">
          {itemName
            ? `${itemName} is not available yet.`
            : 'This workspace section is not available yet.'}
        </p>
      </section>
    </DashboardShell>
  );
}

/**
 * Every dashboard page resolves the session through the ONE destination
 * function (authDestination.ts) instead of keeping its own role list, so a
 * signed-in user can never be bounced between the dashboard and onboarding.
 *
 * Only the supplier workspace exists today: an onboarded Retailer or
 * Entrepreneur account resolves to the dashboard destination but has no
 * workspace, so the route calls `notFound()` and the custom
 * `app/dashboard/not-found.tsx` boundary renders. The URL and the stored
 * account choice stay intact (nothing is saved or re-asked here).
 */
export function DashboardRoute({ mode }: { mode: DashboardRouteMode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/dashboard/overview';
  const { status, user, cachedDisplayName, refreshSession } = useAuthSession();
  const destination = resolveAuthDestination({ status, user });
  const target = redirectTarget(destination, pathname);
  const role = user?.onboardingIntent ? roleForBusinessType(user.onboardingIntent) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [pathname, router, target]);

  // Unauthenticated: the redirect to /auth/login is in flight.
  if (destination.kind === 'login') return null;

  if (destination.kind !== 'dashboard' || !user) {
    // Loading, a failed session check, or a redirect to verify-email /
    // role-selection in flight: keep the dashboard skeleton, never a role UI.
    return (
      <DashboardSessionSkeleton
        displayName={cachedDisplayName}
        onRetry={status === 'error' ? () => void refreshSession() : undefined}
      />
    );
  }

  // Retailer and Entrepreneur have no workspace yet → genuine 404 page.
  if (!isSupplierRole(role)) notFound();

  if (mode === 'section') return <PlaceholderWorkspace user={user} pathname={pathname} />;
  return <OverviewWorkspace user={user} />;
}
