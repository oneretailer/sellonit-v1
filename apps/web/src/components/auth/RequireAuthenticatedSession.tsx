'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';

function SessionSkeleton() {
  return (
    <AuthCard gapClassName="gap-5">
      <span
        role="status"
        aria-label="Loading account"
        className="mx-auto block h-7 w-48 animate-pulse rounded-full bg-gray-200"
      />
      <span className="mx-auto block h-4 w-64 max-w-full animate-pulse rounded-full bg-gray-100" />
      <span className="block h-14 w-full animate-pulse rounded-xl bg-gray-100" />
      <span className="block h-12 w-full animate-pulse rounded-xl bg-gray-100" />
    </AuthCard>
  );
}

/**
 * Guards the onboarding routes (role selection and the account-created success
 * screen). It renders only while the resolved destination is the onboarding
 * step; every other state is redirected through authDestination.ts. Loading is
 * never treated as "not onboarded", so the guard cannot bounce a user who
 * finished onboarding on another browser.
 */
export function RequireAuthenticatedSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, refreshSession } = useAuthSession();
  const destination = resolveAuthDestination({ status, user });
  const target = redirectTarget(destination, pathname);

  useEffect(() => {
    if (target) router.replace(target);
  }, [pathname, router, target]);

  if (destination.kind === 'role-selection') return children;
  if (status === 'error') {
    return (
      <AuthCard gapClassName="gap-4">
        <InlineError className="text-base">
          We couldn&apos;t verify your session. Check your connection and try again.
        </InlineError>
        <PrimaryButton onClick={() => void refreshSession()}>Try again</PrimaryButton>
      </AuthCard>
    );
  }
  // loading, login-, verify-email- or dashboard-bound: show a skeleton only.
  return <SessionSkeleton />;
}
