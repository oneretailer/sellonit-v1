'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
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

/**
 * Keeps public auth pages hidden until the shared cookie-backed session
 * resolves. Signed-in users are sent to their single resolved destination
 * (see authDestination.ts); nothing is decided here.
 */
export function RedirectAuthenticatedUser({
  children,
  locationKey,
}: {
  children: ReactNode;
  locationKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, refreshSession } = useAuthSession();
  const destination = resolveAuthDestination({ status, user });
  const target = redirectTarget(destination, pathname);

  useEffect(() => {
    if (target) router.replace(target);
  }, [locationKey, pathname, router, target]);

  if (destination.kind === 'login') return children;
  // loading, or a redirect is in flight: never render the public form.
  return <SessionGateShell retry={status === 'error' ? () => void refreshSession() : undefined} />;
}
