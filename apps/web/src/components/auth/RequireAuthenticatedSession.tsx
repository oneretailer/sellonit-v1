'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getMe } from '@/lib/auth/api';
import { ApiError } from '@/lib/api-client';
import { getPostAuthDestination } from '@/lib/auth/postAuthDestination';
import { readOnboardingRole } from '@/lib/auth/flowState';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';

type SessionState = 'checking' | 'authenticated' | 'redirecting' | 'error';

async function getSessionAfterHydration() {
  try {
    return await getMe();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return getMe();
  }
}

/** Guards standalone post-registration/onboarding routes with the existing session API. */
export function RequireAuthenticatedSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void getSessionAfterHydration()
      .then(() => {
        if (!active) return;
        if (readOnboardingRole()) {
          setState('redirecting');
          router.replace(getPostAuthDestination());
          return;
        }
        setState('authenticated');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setState('redirecting');
          router.replace('/auth/login');
          return;
        }
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  if (state === 'authenticated') return children;
  if (state === 'redirecting') return null;

  return (
    <AuthCard gapClassName="gap-4">
      {state === 'checking' ? (
        <p role="status" className="text-base text-subtle">
          Checking your session…
        </p>
      ) : (
        <>
          <InlineError className="text-base">
            We couldn&apos;t verify your session. Check your connection and try again.
          </InlineError>
          <PrimaryButton
            onClick={() => {
              setState('checking');
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </PrimaryButton>
        </>
      )}
    </AuthCard>
  );
}
