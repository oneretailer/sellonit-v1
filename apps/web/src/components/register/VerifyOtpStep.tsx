'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { OtpField } from '@/components/reuseable/OtpField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { useCountdown } from '@/hooks/useCountdown';
import {
  PHONE_OTP_MESSAGES,
  phoneOtp,
  toPhoneOtpError,
  type PhoneOtpErrorKind,
} from '@/lib/auth/phone-otp';
import { formatLocalPhoneSpaced, isVerificationCode, toLocalPhone } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

/** How long the user waits before a new code can be requested. */
const RESEND_SECONDS = 30;
const ERROR_ID = 'otp-error';

/**
 * Step 2 of registration: confirm the 6-digit code sent to the phone number from
 * the previous step. It validates only the code, and can resend the code after a
 * countdown. A user who entered the wrong number can go back to step 1.
 */
export function VerifyOtpStep() {
  const { state, markPhoneVerified, goToNextStep, hasNextStep } = useRegisterFlow();
  const phone = state.phone;

  const [code, setCode] = useState('');
  const [error, setError] = useState<PhoneOtpErrorKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [verified, setVerified] = useState(state.phoneVerified);
  const resend = useCountdown(RESEND_SECONDS);

  // The step gate only renders this step once a phone number exists.
  if (phone === null) {
    return null;
  }

  const localPhone = toLocalPhone(phone);
  const displayPhone = formatLocalPhoneSpaced(phone);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCode();
  }

  async function submitCode() {
    if (submitting || blocked || !isVerificationCode(code)) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await phoneOtp.verifyCode(localPhone, code);
      markPhoneVerified();
      setSubmitting(false);
      setVerified(true);
    } catch (err) {
      const kind = toPhoneOtpError(err).kind;
      setSubmitting(false);
      setBlocked(kind === 'too_many_attempts');
      setError(kind);
    }
  }

  async function handleResend() {
    if (resending || blocked) {
      return;
    }
    setError(null);
    setResending(true);
    try {
      await phoneOtp.resendCode(localPhone);
      setCode('');
      resend.restart();
    } catch (err) {
      setError(toPhoneOtpError(err).kind);
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <AuthCard>
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-ink">Phone number verified</h1>
          <p className="text-sm text-subtle">Your phone number {displayPhone} has been verified.</p>
        </div>
        {hasNextStep('verify') ? (
          <PrimaryButton type="button" onClick={() => goToNextStep('verify')}>
            Continue
          </PrimaryButton>
        ) : null}
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-ink">Verify your phone number</h1>
        <p className="text-sm text-subtle">We sent a verification code to {displayPhone}.</p>
      </div>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-3">
          <OtpField
            id="otp-code"
            label="verification code"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
            }}
            error={error !== null}
            disabled={blocked || submitting}
            aria-describedby={error ? ERROR_ID : undefined}
          />
          {error ? <InlineError id={ERROR_ID}>{PHONE_OTP_MESSAGES[error]}</InlineError> : null}
          {blocked ? null : (
            <p className="text-left text-sm text-subtle">
              Didn&apos;t receive code?{' '}
              {resend.remaining > 0 ? (
                <span>
                  You can request another code in {resend.remaining}{' '}
                  {resend.remaining === 1 ? 'second' : 'seconds'}.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resending}
                  className="font-semibold text-ink underline underline-offset-2 disabled:cursor-progress disabled:opacity-60"
                >
                  Resend code
                </button>
              )}
            </p>
          )}
        </div>

        <PrimaryButton
          type="submit"
          disabled={!isVerificationCode(code) || blocked}
          loading={submitting}
        >
          Verify code
        </PrimaryButton>
      </form>

      <p className="text-sm text-subtle">
        Stuck?{' '}
        <Link
          href="/auth/register/phone"
          className="inline-flex items-center gap-1 font-semibold text-subtle underline underline-offset-2"
        >
          change your phone number here
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </Link>
      </p>
    </AuthCard>
  );
}
