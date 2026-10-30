'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { getPostAuthDestination } from '@/lib/auth/postAuthDestination';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';

function SessionGateShell({ retry }: { retry?: () => void }) {
  return (
    <AuthPage>
      <AuthCard gapClassName="gap-5">
        <span
          role="status"
          aria-label="Loading account"
          className="mx-auto block h-7 w-40 animate-pulse rounded-full bg-gray-200"
        />
        <span className="mx-auto block h-4 w-56 max-w-full animate-pulse rounded-full bg-gray-100" />
        {retry ? <PrimaryButton onClick={retry}>Try again</PrimaryButton> : null}
      </AuthCard>
    </AuthPage>
  );
}

/** Keeps public auth pages hidden until the shared cookie-backed session resolves. */
export function RedirectAuthenticatedUser({
  children,
  locationKey,
}: {
  children: ReactNode;
  locationKey: string;
}) {
  const router = useRouter();
  const { status, user, refreshSession } = useAuthSession();

  useEffect(() => {
    if (status === 'authenticated') router.replace(getPostAuthDestination(user));
  }, [locationKey, router, status, user]);

  if (status === 'unauthenticated') return children;
  return <SessionGateShell retry={status === 'error' ? () => void refreshSession() : undefined} />;
}
