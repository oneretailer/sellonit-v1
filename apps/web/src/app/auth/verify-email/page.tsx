'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { resendVerification } from '@/lib/auth/api';
import {
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  setPendingVerificationEmail,
  subscribePendingVerificationEmail,
} from '@/lib/auth/pendingVerification';
import { isEmail } from '@/lib/auth/validation';
import { normalizeEmail } from '@/lib/validation/auth';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailPage() {
  const router = useRouter();
  const pendingEmail = useSyncExternalStore(
    subscribePendingVerificationEmail,
    getPendingVerificationEmail,
    () => null,
  );
  const [manualEmail, setManualEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const email = manualEmail ?? pendingEmail ?? '';
  const hasPendingEmail = pendingEmail !== null && manualEmail === null;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const loginHref = isEmail(normalizedEmail)
    ? `/auth/login?email=${encodeURIComponent(normalizedEmail)}`
    : '/auth/login';

  async function handleResend() {
    if (!isEmail(normalizedEmail) || cooldown > 0 || resendState === 'sending') return;

    setEmailError(null);
    setResendState('sending');
    try {
      await resendVerification({ email: normalizedEmail });
      // Persist only after a resend succeeds; this record contains no password.
      setPendingVerificationEmail(normalizedEmail);
      setManualEmail(null);
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResendState('failed');
    }
  }

  function handleVerifiedLogin() {
    router.push(loginHref);
  }

  return (
    <AuthCard gapClassName="gap-6 md:gap-9">
      <AuthCardHeader icon={<BagMark />} title="Check your email">
        {hasPendingEmail ? (
          <>We sent a verification link to {email}. You can resend it below.</>
        ) : (
          <>Enter your email address to resend a verification link.</>
        )}
      </AuthCardHeader>

      <div className="flex w-full flex-col gap-6 text-left">
        <TextField
          id="verification-email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(value) => {
            if (hasPendingEmail && normalizeEmail(value) !== normalizeEmail(email)) {
              clearPendingVerificationEmail();
            }
            setManualEmail(value);
            setEmailError(value.trim() && !isEmail(value) ? 'Enter a valid email address.' : null);
            setResendState('idle');
          }}
          error={emailError}
          placeholder="Enter your email address"
        />

        <div className="flex w-full flex-col items-center gap-4" aria-live="polite">
          <PrimaryButton
            type="button"
            disabled={!isEmail(normalizedEmail) || cooldown > 0 || resendState === 'sending'}
            loading={resendState === 'sending'}
            className="auth-button text-ink"
            onClick={() => void handleResend()}
          >
            {resendState === 'sending'
              ? 'Sending…'
              : cooldown > 0
                ? `Resend verification link in ${cooldown}s`
                : 'Resend verification link'}
          </PrimaryButton>
          {resendState === 'sent' ? <p className="text-base text-success">Link sent.</p> : null}
          {resendState === 'failed' ? (
            <InlineError className="text-base">
              We couldn&apos;t send a verification link right now. Try again later, or log in once
              you&apos;ve verified your email.
            </InlineError>
          ) : null}
        </div>

        <SecondaryButton
          type="button"
          appearance="outline"
          disabled={!isEmail(normalizedEmail)}
          onClick={handleVerifiedLogin}
        >
          I&apos;ve verified my email
        </SecondaryButton>
        <p className="text-center text-base text-subtle">
          Ready to continue?{' '}
          <Link href={loginHref} className="font-semibold text-ink underline underline-offset-2">
            Log in
          </Link>
        </p>
        <p className="text-center text-base text-subtle">
          Need to use a different address?{' '}
          <Link
            href="/auth/register"
            className="font-semibold text-ink underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
