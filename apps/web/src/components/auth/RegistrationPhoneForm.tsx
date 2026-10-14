'use client';

import { useState } from 'react';
import { Field } from './Field';
import { RegistrationGuard, useRegistration } from './RegistrationFlow';
import { register } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';
import { isNigerianPhoneDigits, onlyDigits, toLocalPhone } from '@/lib/auth/validation';

export function RegistrationPhoneForm() {
  const { state, dispatch, next } = useRegistration();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy || !state.details) return;
    if (phone && !isNigerianPhoneDigits(phone)) {
      setError('Enter a valid 10-digit Nigerian phone number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const registration = await register({
        ...state.details,
        ...(phone ? { phone: toLocalPhone(phone) } : {}),
      });
      dispatch({ type: 'registered', registration });
      next('/auth/register/phone', Boolean(registration.data.phone));
    } catch (cause) {
      setError(authErrorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <RegistrationGuard allowed={Boolean(state.details)}>
      <h1 className="card-title">Add a phone number</h1>
      <p className="card-subtitle">
        Optional. If provided, we&apos;ll send a verification code when your account is created.
      </p>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Field
          id="phone"
          label="Phone number (optional)"
          prefix="+234"
          value={phone}
          onChange={(value) => setPhone(onlyDigits(value, 10))}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="803 123 4567"
          maxLength={10}
        />
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </RegistrationGuard>
  );
}
