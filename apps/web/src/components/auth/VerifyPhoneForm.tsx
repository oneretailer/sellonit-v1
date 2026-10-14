'use client';

import { useState } from 'react';
import { RegistrationGuard, useRegistration } from './RegistrationFlow';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Field } from './Field';
import { verifyPhone } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';
import { formatPhoneDisplay, isVerificationCode, onlyDigits } from '@/lib/auth/validation';

export function VerifyPhoneForm() {
  const { state, dispatch, next } = useRegistration();
  const phone = state.registration?.data.phone ?? null;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);

  const validPhone = phone !== null && /^(0\d{10}|\+234\d{10})$/.test(phone);

  if (!validPhone) {
    return (
      <RegistrationGuard allowed={false}>
        <div>
          <h1 className="card-title">Verify your phone number</h1>
          <p className="card-subtitle">
            Enter your phone number first and we&apos;ll send you a 6-digit verification code.
          </p>
          <Link className="btn btn-primary" href="/auth/register">
            Enter your phone number
          </Link>
        </div>
      </RegistrationGuard>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm();
  }

  async function submitForm() {
    if (submitting) {
      return;
    }
    if (!isVerificationCode(code)) {
      setError('Enter the 6-digit code from the text message.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyPhone(code);
      setSubmitting(false);
      if (result.data.verified) {
        dispatch({ type: 'phoneVerified' });
        setVerified(true);
      } else {
        setError('That code is not correct. Check the text message and try again.');
      }
    } catch (err) {
      setSubmitting(false);
      setError(authErrorMessage(err));
    }
  }

  if (verified) {
    return (
      <div className="success-panel">
        <span className="success-icon" aria-hidden="true">
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
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h1 className="card-title">Phone number verified</h1>
        <p className="card-subtitle success-copy">
          Your number is verified. Check your email inbox and click the verification link to finish
          setting up your account, then log in to continue.
        </p>
        <button className="btn btn-primary" onClick={() => next('/auth/verify')}>
          Continue to email verification
        </button>
        <Link className="link" href="/auth/register">
          Start a new registration
        </Link>
      </div>
    );
  }

  return (
    <RegistrationGuard allowed={Boolean(state.registration && phone)}>
      <h1 className="card-title">Verify your phone number</h1>
      <p className="card-subtitle">
        Your account was created. Check for a 6-digit code sent to{' '}
        <strong>{formatPhoneDisplay(phone)}</strong>. Enter it below to verify your number.
      </p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field
          id="code"
          label="Verification code"
          value={code}
          onChange={(value) => {
            setCode(onlyDigits(value, 6));
            if (error) {
              setError(null);
            }
          }}
          error={error}
          inputClassName="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Verifying…
            </>
          ) : (
            'Verify code'
          )}
        </button>
        <p className="field-helper verify-note">
          Didn&apos;t get a code? It expires 10 minutes after it&apos;s sent.
        </p>
      </form>
      <button className="link" onClick={() => next('/auth/verify')}>
        Skip for now — phone verification is optional
      </button>
    </RegistrationGuard>
  );
}
