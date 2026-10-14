'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PhoneField } from '@/components/reuseable/PhoneField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import {
  PHONE_OTP_MESSAGES,
  phoneOtp,
  toPhoneOtpError,
  type PhoneOtpErrorKind,
} from '@/lib/auth/phone-otp';
import { isNigerianPhoneDigits, normalizePhoneInput, toLocalPhone } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

const HELPER_ID = 'phone-helper';
const ERROR_ID = 'phone-error';

/**
 * Step 1 of registration: the phone number. It validates only the phone field,
 * requests the verification code, and then moves to the verify step.
 */
export function PhoneStep() {
  const { state, savePhone, goToNextStep } = useRegisterFlow();
  // Initialised from the store, so going back here keeps the number typed earlier.
  const [digits, setDigits] = useState(state.phone ?? '');
  const [error, setError] = useState<PhoneOtpErrorKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPhone();
  }

  async function submitPhone() {
    if (submitting) {
      return;
    }
    if (!isNigerianPhoneDigits(digits)) {
      setError('invalid_phone');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await phoneOtp.sendCode(toLocalPhone(digits));
      savePhone(digits);
      goToNextStep('phone');
    } catch (err) {
      setSubmitting(false);
      setError(toPhoneOtpError(err).kind);
    }
  }

  return (
    <AuthCard>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="text-sm text-subtle">
          Use your phone number to create an account on sellonit
        </p>
      </div>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-3 text-left">
          <PhoneField
            id="phone"
            inputRef={inputRef}
            value={digits}
            onChange={(value) => {
              setDigits(normalizePhoneInput(value));
              setError(null);
            }}
            error={error !== null}
            aria-describedby={error ? ERROR_ID : HELPER_ID}
            maxLength={14}
            disabled={submitting}
          />
          {error ? (
            <InlineError id={ERROR_ID}>
              {PHONE_OTP_MESSAGES[error]}
              {error === 'phone_exists' ? (
                <>
                  {' '}
                  <Link href="/auth/login" className="font-semibold text-subtle underline">
                    Log in
                  </Link>{' '}
                  to continue.
                </>
              ) : null}
            </InlineError>
          ) : (
            <p id={HELPER_ID} className="text-sm text-gray-500">
              We will use this phone number to verify your account and send you important account
              update
            </p>
          )}
        </div>

        <PrimaryButton type="submit" loading={submitting}>
          Continue
        </PrimaryButton>
      </form>

      <p className="text-sm text-subtle">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-semibold text-subtle underline underline-offset-2">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
