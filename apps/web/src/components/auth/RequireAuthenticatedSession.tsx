'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthDestination } from '@/lib/auth/postAuthDestination';
import { readOnboardingRole } from '@/lib/auth/flowState';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';

const subscribeWithoutRoleChanges = () => () => {};

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

/** Shared guard for authenticated onboarding and success routes. */
export function RequireAuthenticatedSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, refreshSession } = useAuthSession();
  const role = useSyncExternalStore(subscribeWithoutRoleChanges, readOnboardingRole, () => null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
    } else if (status === 'authenticated' && role) {
      router.replace(getPostAuthDestination());
    }
  }, [role, router, status]);

  if (status === 'unauthenticated' || (status === 'authenticated' && role)) return null;
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
  if (status !== 'authenticated') return <SessionSkeleton />;
  return children;
}
