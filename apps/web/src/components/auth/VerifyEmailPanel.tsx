'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { verifyEmail } from '@/lib/auth/api';
import { emailLinkErrorMessage } from '@/lib/auth/errors';

type VerifyStatus =
  { kind: 'verifying' } | { kind: 'verified' } | { kind: 'error'; message: string };

/**
 * Target of the email link: `/verify-email?token=...`. It calls
 * POST /auth/verify-email once, on mount. The ref stops React StrictMode from
 * running the effect twice, which would use a single-use token twice.
 */
export function VerifyEmailPanel({ token }: { token: string | null }) {
  const [status, setStatus] = useState<VerifyStatus>(() =>
    token
      ? { kind: 'verifying' }
      : {
          kind: 'error',
          message: 'This verification link is incomplete. Open the link from your email.',
        },
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }
    startedRef.current = true;
    verifyEmail(token)
      .then(() => setStatus({ kind: 'verified' }))
      .catch((err: unknown) => setStatus({ kind: 'error', message: emailLinkErrorMessage(err) }));
  }, [token]);

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
      <Link
        href="/auth/login"
        className="text-sm font-semibold text-subtle underline underline-offset-2"
      >
        Go to log in
      </Link>
    </AuthCard>
  );
}
