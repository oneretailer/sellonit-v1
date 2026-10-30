'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { Spinner } from '@/components/reuseable/Spinner';
import { TextField } from '@/components/reuseable/TextField';
import { getMe, resendVerification } from '@/lib/auth/api';
import { AUTH_ROUTE, resolveAuthDestination } from '@/lib/auth/authDestination';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import type { AuthUser } from '@/lib/auth/types';
import {
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  setPendingVerificationEmail,
  subscribePendingVerificationEmail,
} from '@/lib/auth/pendingVerification';
import { subscribeEmailVerified } from '@/lib/auth/verificationSignal';
import { isEmail } from '@/lib/auth/validation';
import { normalizeEmail } from '@/lib/validation/auth';

const RESEND_COOLDOWN_SECONDS = 30;
/** How often the page asks the API whether the email is verified yet. */
const POLL_INTERVAL_MS = 2500;
/** After this long we stop the automatic poll and point at the manual button. */
const POLL_TIMEOUT_MS = 120_000;

type VerificationCheck = 'waiting' | 'timed-out' | 'verified';

/**
 * "Check your email".
 *
 * The verification link may be opened on another device, so this page watches
 * the account instead of the link: it re-checks GET /auth/me every 2.5s, on
 * `focus`, on `visibilitychange`, and when another tab broadcasts that it just
 * verified (BroadcastChannel + storage fallback). As soon as the account shows
 * `emailVerifiedAt` it goes straight into the app through the shared
 * destination function. Automatic polling stops after 2 minutes, on unmount and
 * on success; the "I've verified my email" button always force-checks.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const { acceptAuthenticatedUser } = useAuthSession();
  const pendingEmail = useSyncExternalStore(
    subscribePendingVerificationEmail,
    getPendingVerificationEmail,
    () => null,
  );
  const [manualEmail, setManualEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [check, setCheck] = useState<VerificationCheck>('waiting');
  const [forceChecking, setForceChecking] = useState(false);
  const inFlight = useRef(false);
  const email = manualEmail ?? pendingEmail ?? '';
  const hasPendingEmail = pendingEmail !== null && manualEmail === null;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Warm the next routes so the hand-off after verification is instant.
  useEffect(() => {
    try {
      router.prefetch?.(AUTH_ROUTE.roleSelection);
      router.prefetch?.(AUTH_ROUTE.dashboard);
    } catch {
      // Prefetching is an optimisation only.
    }
  }, [router]);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const loginHref = isEmail(normalizedEmail)
    ? `/auth/login?email=${encodeURIComponent(normalizedEmail)}`
    : '/auth/login';

  /** Reads the account once. 401 (still signed out) is not an error here. */
  const readVerifiedUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const { data } = await getMe();
      return data.emailVerifiedAt ? data : null;
    } catch {
      return null;
    }
  }, []);

  /** Session is established (or already existed): go where the account belongs. */
  const finishVerified = useCallback(
    (user: AuthUser) => {
      setCheck('verified');
      acceptAuthenticatedUser(user);
      router.replace(
        resolveAuthDestination({ status: 'authenticated', user }).path ?? AUTH_ROUTE.roleSelection,
      );
    },
    [acceptAuthenticatedUser, router],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();
    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    async function checkOnce(source: 'poll' | 'event'): Promise<void> {
      if (cancelled) return;
      // Don't burn requests on a background tab; the next poll after it becomes
      // visible again picks the state up.
      if (source === 'poll' && document.visibilityState === 'hidden') {
        schedule();
        return;
      }
      const user = await readVerifiedUser();
      if (cancelled) return;
      if (user) {
        stop();
        finishVerified(user);
        return;
      }
      if (source === 'event') return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        stop();
        setCheck('timed-out');
        return;
      }
      schedule();
    }

    function schedule(): void {
      if (cancelled) return;
      stop();
      timer = window.setTimeout(() => void checkOnce('poll'), POLL_INTERVAL_MS);
    }

    void checkOnce('poll');
    const onWake = () => void checkOnce('event');
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    const unsubscribeSignal = subscribeEmailVerified(onWake);
    return () => {
      cancelled = true;
      stop();
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
      unsubscribeSignal();
    };
  }, [finishVerified, readVerifiedUser]);

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

  /**
   * Force-check. A confirmed account goes straight into the app; otherwise we
   * can only send the user to login (which re-asks the API) — the session is
   * what proves verification, not this browser.
   */
  async function handleForceCheck() {
    if (inFlight.current) return;
    inFlight.current = true;
    setForceChecking(true);
    const user = await readVerifiedUser();
    if (user) {
      finishVerified(user);
      return;
    }
    inFlight.current = false;
    setForceChecking(false);
    router.push(loginHref);
  }

  return (
    <div className="w-full pt-15">
      <div className="flex w-full items-center justify-center">
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
                setEmailError(
                  value.trim() && !isEmail(value) ? 'Enter a valid email address.' : null,
                );
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
                  We can&apos;t resend the verification link yet. Check your inbox (and spam folder)
                  for the link we sent when you signed up, or log in once you&apos;ve verified your
                  email.
                </InlineError>
              ) : null}
            </div>

            {/* Live verification status — this page watches the account itself. */}
            <div className="rounded-xl border border-line bg-canvas px-4 py-3 text-center">
              {check === 'verified' ? (
                <p className="text-base font-medium text-success">
                  Email verified. Taking you into Sellonit…
                </p>
              ) : (
                <p className="flex items-center justify-center gap-2 text-base text-subtle">
                  <Spinner />
                  {check === 'timed-out'
                    ? 'Still waiting for confirmation.'
                    : 'Waiting for you to verify your email…'}
                </p>
              )}
              <p className="mt-1 text-sm text-subtle">
                {check === 'timed-out'
                  ? 'Open the link in your inbox, then press “I’ve verified my email”.'
                  : 'We check automatically — this page updates the moment it’s confirmed.'}
              </p>
            </div>

            <SecondaryButton
              type="button"
              appearance="outline"
              loading={forceChecking}
              disabled={forceChecking}
              onClick={() => void handleForceCheck()}
            >
              I&apos;ve verified my email
            </SecondaryButton>
            <p className="text-center text-base text-subtle">
              Ready to continue?{' '}
              <Link
                href={loginHref}
                className="font-semibold text-ink underline underline-offset-2"
              >
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
      </div>
    </div>
  );
}
