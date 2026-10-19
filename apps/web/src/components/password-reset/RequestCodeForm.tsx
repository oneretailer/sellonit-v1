'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { authMessageFor, mapSendCodeError, sendResetCode } from '@/lib/auth/authService';
import { normalizeIdentifier, validateIdentifier } from '@/lib/auth/identifier';
import { clearAuthFlow, resendAvailableAfterSend, writeAuthFlow } from '@/lib/auth/flowState';

/**
 * Forgot password, step 1 (Figma: Reset your password). Sends a reset code to
 * the email or phone entered, then moves to the code step.
 */
export function RequestCodeForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  // A fresh flow starts here, so any half-finished one is discarded.
  useEffect(() => {
    clearAuthFlow();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    const message = validateIdentifier(identifier);
    setIdentifierError(message);
    setFormError(null);
    if (message) {
      return;
    }
    const target = normalizeIdentifier(identifier);
    inFlight.current = true;
    setSubmitting(true);
    try {
      await sendResetCode(target);
      writeAuthFlow({
        step: 'verify',
        identifier: target.identifier,
        identifierType: target.identifierType,
        purpose: 'reset-password',
        resendAvailableAt: resendAvailableAfterSend(),
      });
      router.push('/auth/forgot-password/verify');
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      const failure = mapSendCodeError(error);
      if (failure === 'account-not-found') {
        setIdentifierError(authMessageFor(failure));
      } else {
        setFormError(authMessageFor(failure));
      }
    }
  }

  return (
    <AuthCard gapClassName="gap-9">
      <StepHeader title="Reset your password" align="left">
        Enter the email or phone number linked to your sellonit account and we will send you a
        verification code
      </StepHeader>

      <form
        className="flex w-full flex-col gap-6 text-left"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <TextField
          id="identifier"
          label="Email or phone number"
          placeholder="Email or phone number"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={identifier}
          onChange={(value) => {
            setIdentifier(value);
            setIdentifierError(null);
            setFormError(null);
          }}
          error={identifierError}
          disabled={submitting}
        />

        {formError ? <InlineError>{formError}</InlineError> : null}

        <div className="flex w-full flex-col gap-3">
          <PrimaryButton type="submit" loading={submitting}>
            Send verification code
          </PrimaryButton>
          <SecondaryButton
            disabled={submitting}
            onClick={() => {
              clearAuthFlow();
              router.push('/auth/login');
            }}
          >
            Back to login
          </SecondaryButton>
        </div>
      </form>
    </AuthCard>
  );
}
