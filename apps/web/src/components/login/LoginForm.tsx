'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PasswordField } from '@/components/reuseable/PasswordField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { AppleMark, GoogleMark } from '@/components/reuseable/SocialProviderMarks';
import { AlertCircleIcon, RefreshIcon } from '@/components/reuseable/icons';
import { TextField } from '@/components/reuseable/TextField';
import {
  AUTH_MESSAGES,
  authMessageFor,
  loginWithIdentifier,
  mapLoginError,
  mapResendCodeError,
  resendCode,
} from '@/lib/auth/authService';
import {
  normalizeIdentifier,
  validateIdentifier,
  type NormalizedIdentifier,
} from '@/lib/auth/identifier';
import { resendAvailableAfterSend, writeAuthFlow } from '@/lib/auth/flowState';

export type LoginFormProps = {
  /** Pre-filled identifier from `?email=` (e.g. after the "already exists" redirect). */
  initialIdentifier?: string;
};

/**
 * Login (Figma: Welcome back). One card with the identifier and password
 * fields, Remember me, Forgot password, the Log In button, and a footer link to
 * Create an account. Posts to POST /auth/login through authService.
 */
export function LoginForm({ initialIdentifier = '' }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set when login reports an unverified account. Holds the identifier that was tried. */
  const [unverified, setUnverified] = useState<NormalizedIdentifier | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Synchronous guard against double submits (state updates are asynchronous).
  const inFlight = useRef(false);
  const busy = submitting || resending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    const identifierMessage = validateIdentifier(identifier);
    const passwordMessage = password.length === 0 ? 'Enter your password.' : null;
    setIdentifierError(identifierMessage);
    setPasswordError(passwordMessage);
    setFormError(null);
    setResendError(null);
    setUnverified(null);
    if (identifierMessage || passwordMessage) {
      return;
    }

    const target = normalizeIdentifier(identifier);
    inFlight.current = true;
    setSubmitting(true);
    try {
      await loginWithIdentifier({ ...target, password });
      // Stays disabled while the app navigates away.
      router.replace('/account');
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      const failure = mapLoginError(error);
      if (failure === 'wrong-credentials') {
        setFormError(authMessageFor(failure));
      } else if (failure === 'account-not-verified') {
        setUnverified(target);
      } else {
        setFormError(authMessageFor(failure));
      }
    }
  }

  async function handleResend() {
    if (!unverified || busy) {
      return;
    }
    setResending(true);
    setResendError(null);
    try {
      await resendCode({ ...unverified, purpose: 'verify-account' });
      writeAuthFlow({
        step: 'verify',
        identifier: unverified.identifier,
        identifierType: unverified.identifierType,
        purpose: 'verify-account',
        resendAvailableAt: resendAvailableAfterSend(),
      });
      router.push('/auth/verify-account');
    } catch (error) {
      setResending(false);
      setResendError(authMessageFor(mapResendCodeError(error)));
    }
  }

  return (
    <AuthCard gapClassName="gap-6 sm:gap-12">
      <StepHeader title="Welcome back" align="center" icon={<BagMark />}>
        Log in to continue to your Sellonit account
      </StepHeader>

      <form
        className="flex w-full flex-col gap-6 text-left"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <TextField
          id="identifier"
          label="Email or phone number"
          placeholder="Enter your email address or phone number"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={identifier}
          onChange={(value) => {
            setIdentifier(value);
            setIdentifierError(null);
            setUnverified(null);
            setFormError(null);
          }}
          error={identifierError}
          disabled={busy}
        />

        <div className="flex w-full flex-col gap-3">
          <PasswordField
            id="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setPasswordError(null);
              setFormError(null);
            }}
            error={passwordError}
            disabled={busy}
          />

          {/* Unverified notice: same slot as the password error. */}
          {unverified ? (
            <div className="flex flex-col gap-2">
              <p
                aria-live="polite"
                className="flex items-start gap-2 text-left text-sm text-amber-700"
              >
                <AlertCircleIcon className="mt-0.5 size-4 text-amber-700" />
                <span>{AUTH_MESSAGES.accountNotVerified}</span>
              </p>
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={busy}
                className="flex items-center gap-1.5 self-start text-sm font-semibold text-subtle underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                <RefreshIcon />
                Didn&apos;t get a code? Resend
              </button>
              {resendError ? <InlineError>{resendError}</InlineError> : null}
            </div>
          ) : null}
        </div>

        <div className="flex w-full items-center justify-between gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={busy}
              className="size-4 accent-primary"
            />
            Remember me
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-semibold text-subtle underline underline-offset-2 hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>

        {formError ? <InlineError>{formError}</InlineError> : null}

        {/* TODO(google-auth): supply OAuth handler/redirect before enabling provider controls. */}
        {/* TODO(apple-auth): supply OAuth handler/redirect before enabling provider controls. */}
        <div className="flex w-full flex-col gap-4">
          <PrimaryButton type="submit" loading={submitting}>
            {submitting ? 'Logging in…' : 'Log In'}
          </PrimaryButton>
          <p className="py-1 text-center text-sm font-bold text-ink">OR</p>
          <button
            type="button"
            aria-disabled="true"
            className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-line bg-white px-5 text-base font-medium text-ink"
          >
            <GoogleMark /> Log in with Google
          </button>
          <button
            type="button"
            aria-disabled="true"
            className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-line bg-white px-5 text-base font-medium text-ink"
          >
            <AppleMark /> Log in with Apple
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-subtle">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/register"
          className="font-semibold text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
