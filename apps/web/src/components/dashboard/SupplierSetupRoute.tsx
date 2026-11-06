'use client';

import { useEffect } from 'react';
import { notFound, usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@/components/reuseable/Navbar';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import { roleForBusinessType } from '@/lib/onboarding/roleApi';
import { isSupplierRole } from '@/lib/onboarding/roles';
import { SupplierSetupScreen } from './SupplierSetupScreen';

function SetupSessionSkeleton({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas" aria-busy="true">
      <Navbar rightLink={{ label: 'Supplier Set up', variant: 'text' }} />
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:items-center-safe md:px-6 md:py-12">
        <div className="flex w-full max-w-[480px] flex-col gap-5 rounded-card border border-line bg-surface p-6 md:p-8">
          <span
            role="status"
            aria-label="Loading supplier setup"
            className="block h-7 w-64 max-w-full animate-pulse rounded-full bg-gray-200"
          />
          <span className="block h-4 w-full animate-pulse rounded-full bg-gray-100" />
          <span className="block h-48 w-full animate-pulse rounded-2xl bg-gray-50" />
          <span className="block h-12 w-full animate-pulse rounded-xl bg-gray-100" />
          {onRetry ? <PrimaryButton onClick={onRetry}>Try again</PrimaryButton> : null}
        </div>
      </main>
    </div>
  );
}

/**
 * Guard for /dashboard/supplier-setup. Resolves the session through the ONE
 * destination function (authDestination.ts), exactly like DashboardRoute, so a
 * signed-in user is never bounced between the dashboard and onboarding. Only
 * the supplier workspace exists today; other roles get the 404 boundary.
 */
export function SupplierSetupRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, refreshSession } = useAuthSession();
  const destination = resolveAuthDestination({ status, user });
  const target = redirectTarget(destination, pathname);
  const role = user?.onboardingIntent ? roleForBusinessType(user.onboardingIntent) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [pathname, router, target]);

  if (destination.kind === 'login') return null;
  if (destination.kind !== 'dashboard' || !user) {
    return (
      <SetupSessionSkeleton
        onRetry={status === 'error' ? () => void refreshSession() : undefined}
      />
    );
  }
  if (!isSupplierRole(role)) notFound();
  return <SupplierSetupScreen />;
}
