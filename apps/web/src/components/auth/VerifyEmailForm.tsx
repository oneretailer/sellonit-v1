'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Field } from './Field';
import { DevEmailVerification } from './DevEmailVerification';
import { RegistrationGuard, useRegistration } from './RegistrationFlow';
import { verifyEmail } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';

export function VerifyEmailForm({ linkToken }: { linkToken: string | null }) {
  const { state, next } = useRegistration();
  const [token, setToken] = useState(linkToken ?? '');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function verify(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyEmail(value.trim());
      setVerified(result.data.verified);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  // Inbox links must work independently of an in-memory registration in this tab.
  return (
    <RegistrationGuard allowed={Boolean(linkToken || state.registration)}>
      <h1 className="card-title">{verified ? 'Email verified' : 'Verify your email'}</h1>
      {verified ? (
        <>
          <p className="card-subtitle">
            Your email is verified. Log in with your email and password to continue.
          </p>
          <button className="btn btn-primary" onClick={() => next('/verify-email')}>
            Log in
          </button>
        </>
      ) : (
        <>
          <p className="card-subtitle">
            Check {state.registration?.data.email ?? 'your inbox'} for the verification link. It
            expires after 24 hours. Open it or enter its token below.
          </p>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void verify(token);
            }}
          >
            <Field
              id="email-token"
              label="Email verification token"
              value={token}
              onChange={setToken}
              autoComplete="off"
            />
            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy || !token.trim()} aria-busy={busy}>
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
          <DevEmailVerification
            token={state.registration?.emailVerificationToken}
            busy={busy}
            verify={(value) => {
              void verify(value);
            }}
          />
          <p className="field-helper">
            No resend endpoint is available. If the link expires, contact support.
          </p>
          <Link className="link" href="/auth/login">
            Already verified? Log in
          </Link>
        </>
      )}
    </RegistrationGuard>
  );
}
