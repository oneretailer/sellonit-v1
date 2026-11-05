'use client';

/**
 * Shared supplier-dashboard page frame: session resolution (same rules as
 * DashboardRoute), the app shell, and the central access-state panels.
 * Product pages render inside this so error/empty/access UI lives in ONE
 * place and always keeps the header + sidebar visible.
 */
import { useEffect, type ReactNode } from 'react';
import { notFound, usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import { roleForBusinessType } from '@/lib/onboarding/roleApi';
import { isSupplierRole } from '@/lib/onboarding/roles';
import { useBusiness, type BusinessPermission } from '@/lib/business/BusinessProvider';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';
import type { DashboardAccessState } from '@/lib/dashboard/access';
import { StatePanel } from '@/components/workspace/StatePanel';
import { DashboardShell } from './DashboardShell';
import { DashboardSessionSkeleton } from './DashboardRoute';

function AccessPanel({ state, retry }: { state: DashboardAccessState; retry: () => void }) {
  const router = useRouter();
  const { setSwitcherOpen } = useBusiness();
  switch (state) {
    case 'load-failed':
      return <StatePanel icon="wifi-off" tone="gray" title="We couldn't load your dashboard" description="Something went wrong while loading your workspace. Check your connection and try again." actions={<button type="button" onClick={retry} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Retry</button>} />;
    case 'business-unavailable':
      return <StatePanel icon="business" tone="cream" title="This business is no longer available" description="It may have been removed or you no longer have access. Switch to another business to continue." actions={<button type="button" onClick={() => setSwitcherOpen(true)} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Switch business</button>} />;
    case 'business-denied':
      return <StatePanel icon="lock" tone="red" title="You don't have access to this business" description="Your role no longer permits access to this workspace. Contact the business owner if you think this is a mistake." actions={<button type="button" onClick={() => router.back()} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Go back</button>} />;
    case 'page-forbidden':
      return <StatePanel icon="shield" tone="gray" title="You don't have permission to view this page" description="Your role in this business doesn't include this section. Ask the owner for access or switch to another business." actions={<>
        <button type="button" onClick={() => setSwitcherOpen(true)} className="min-h-11 rounded-xl border border-line bg-white px-6 text-sm font-semibold text-ink transition-colors hover:bg-gray-50">Switch business</button>
        <button type="button" onClick={() => router.push('/dashboard/overview')} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Back to dashboard</button>
      </>} />;
    case 'no-business':
      // Assumption: the brief's state 5 copy is unspecified; keep it actionable.
      return <StatePanel icon="business" tone="cream" title="Create your first business" description="You need a business before you can add products and start selling on Sellonit." actions={<button type="button" onClick={() => router.push('/auth/create-business')} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Create business</button>} />;
    case 'ok':
    case 'loading':
    case 'session-expired':
      return null;
  }
}

export function DashboardFrame({
  children,
  permission,
}: {
  children: ReactNode;
  /** Required permission for the page; omit for pages every member can see. */
  permission?: BusinessPermission;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/dashboard/overview';
  const { status, user, cachedDisplayName, refreshSession } = useAuthSession();
  const access = useDashboardAccess(permission);
  const destination = resolveAuthDestination({ status, user });
  const target = redirectTarget(destination, pathname);
  const role = user?.onboardingIntent ? roleForBusinessType(user.onboardingIntent) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [pathname, router, target]);

  if (destination.kind === 'login') return null;
  if (destination.kind !== 'dashboard' || !user) {
    return (
      <DashboardSessionSkeleton
        displayName={cachedDisplayName}
        onRetry={status === 'error' ? () => void refreshSession() : undefined}
      />
    );
  }
  if (!isSupplierRole(role)) notFound();

  const blocked = access.state !== 'ok' && access.state !== 'loading' && access.state !== 'session-expired';
  return (
    <DashboardShell user={user} activePath={blocked ? '/dashboard/overview' : pathname}>
      {access.state === 'loading' || access.state === 'session-expired' ? (
        <div aria-busy="true" className="flex flex-col gap-6">
          <span className="block h-9 w-56 animate-pulse rounded-xl bg-gray-100" />
          <span className="block h-64 animate-pulse rounded-3xl bg-gray-100" />
        </div>
      ) : blocked ? (
        <AccessPanel state={access.state} retry={access.retry} />
      ) : (
        children
      )}
    </DashboardShell>
  );
}
