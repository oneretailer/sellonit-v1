'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { OtpField } from '@/components/reuseable/OtpField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { verifyPhone } from '@/lib/auth/api';
import { phoneCodeErrorMessage } from '@/lib/auth/errors';
import {
  formatPhoneDisplay,
  isVerificationCode,
  onlyDigits,
  toLocalPhone,
} from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

const ERROR_ID = 'code-error';

/**
 * Phone code step. It appears only when a phone number was given, and it runs
 * after the account exists. It sends the 6-digit SMS code with
 * POST /auth/verify-phone, which needs no session. The code expires 10 minutes
 * after it was sent. The API has no resend endpoint, so there is no resend button.
 */
export function VerifyPhoneStep() {
  const { state, markPhoneVerified, goToNextStep } = useRegisterFlow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(state.phoneVerified);

  const phone = state.phone;
  if (phone === null) {
    return null;
  }

  async function submitCode() {
    if (submitting) {
      return;
    }
    if (!isVerificationCode(code)) {
      setError('Enter the 6-digit code from the text message.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await verifyPhone(code);
      markPhoneVerified();
      setVerified(true);
    } catch (err) {
      setError(phoneCodeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (verified) {
    return (
      <AuthCard>
        <StepHeader title="Phone number verified">
          {formatPhoneDisplay(toLocalPhone(phone))} is now verified.
        </StepHeader>
        <PrimaryButton type="button" onClick={() => goToNextStep('verify-phone')}>
          Continue
        </PrimaryButton>
      </AuthCard>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCode();
  }

  return (
    <AuthCard>
      <StepHeader title="Enter verification code">
        We sent a 6-digit code by text message to {formatPhoneDisplay(toLocalPhone(phone))}.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-3 text-left">
          <OtpField
            id="code"
            label="Verification code"
            value={code}
            onChange={(value) => {
              setCode(onlyDigits(value));
              setError(null);
            }}
            error={error !== null}
            aria-describedby={error ? ERROR_ID : undefined}
            disabled={submitting}
          />
          {error ? (
            <InlineError id={ERROR_ID}>{error}</InlineError>
          ) : (
            <p className="text-sm text-gray-500">The code expires 10 minutes after it was sent.</p>
          )}
        </div>

        <div className="flex w-full flex-col gap-4">
          <PrimaryButton type="submit" loading={submitting} disabled={code.length !== 6}>
            Verify code
          </PrimaryButton>
          <button
            type="button"
            onClick={() => goToNextStep('verify-phone')}
            disabled={submitting}
            className="text-sm font-semibold text-subtle underline underline-offset-2 disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
