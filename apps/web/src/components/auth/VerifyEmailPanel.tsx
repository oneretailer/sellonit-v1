'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryButton, PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { verifyEmail } from '@/lib/auth/api';
import { emailLinkErrorMessage, isRetryableAuthError } from '@/lib/auth/errors';

type VerifyStatus =
  | { kind: 'verifying' }
  | { kind: 'verified' }
  | { kind: 'error'; message: string; retryable: boolean };

/**
 * Target of the email link: `/verify-email?token=...`. It calls
 * POST /auth/verify-email once, on mount. The ref stops React StrictMode from
 * running the effect twice, which would use a single-use token twice.
 *
 * The token is only consumed on success, so transient failures (offline, a
 * server hiccup) can be retried with the same link; a failed retry keeps the
 * same error state and can be retried again.
 */
export function VerifyEmailPanel({ token }: { token: string | null }) {
  const [status, setStatus] = useState<VerifyStatus>(() =>
    token
      ? { kind: 'verifying' }
      : {
          kind: 'error',
          message: 'This verification link is incomplete. Open the link from your email.',
          retryable: false,
        },
  );
  const startedRef = useRef(false);

  const runVerification = useCallback((value: string) => {
    setStatus({ kind: 'verifying' });
    verifyEmail(value)
      .then(() => setStatus({ kind: 'verified' }))
      .catch((err: unknown) =>
        setStatus({
          kind: 'error',
          message: emailLinkErrorMessage(err),
          retryable: isRetryableAuthError(err),
        }),
      );
  }, []);

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }
    startedRef.current = true;
    runVerification(token);
  }, [token, runVerification]);

  if (status.kind === 'verifying') {
    return (
      <AuthCard>
        <StepHeader title="Verifying your email">This will only take a moment.</StepHeader>
      </AuthCard>
    );
  }

  if (status.kind === 'verified') {
    return (
      <AuthCard>
        <StepHeader title="Email verified">
          Your email address is verified. You can log in now.
        </StepHeader>
        <PrimaryLinkButton href="/auth/login">Log in</PrimaryLinkButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <StepHeader title="We could not verify your email">{status.message}</StepHeader>
      <div className="flex w-full flex-col gap-4">
        {status.retryable && token ? (
          <PrimaryButton type="button" onClick={() => runVerification(token)}>
            Try again
          </PrimaryButton>
        ) : null}
        <Link
          href="/auth/login"
          className="text-sm font-semibold text-subtle underline underline-offset-2"
        >
          Go to log in
        </Link>
      </div>
    </AuthCard>
  );
}
