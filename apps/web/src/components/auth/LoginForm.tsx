'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { login } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';
import { isEmail } from '@/lib/auth/validation';

/**
 * Email and password login. This is the existing single-form flow; it is not
 * part of the registration step controller, and it has not been redesigned yet.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm();
  }

  async function submitForm() {
    if (submitting) {
      return;
    }
    setServerError(null);
    const nextEmailError = isEmail(email) ? null : 'Enter a valid email address.';
    const nextPasswordError = password.length > 0 ? null : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      document.getElementById(nextEmailError ? 'email' : 'password')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // The API set the session cookie; follow the actual authenticated flow.
      router.replace('/account');
    } catch (error) {
      setSubmitting(false);
      setServerError(authErrorMessage(error));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-bold text-ink">Log in</h1>
        <p className="text-sm text-subtle">
          Welcome back. Enter your email and password to continue.
        </p>
      </div>
      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        {serverError ? <InlineError>{serverError}</InlineError> : null}
        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (emailError) {
              setEmailError(null);
            }
          }}
          error={emailError}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) {
              setPasswordError(null);
            }
          }}
          error={passwordError}
          autoComplete="current-password"
          placeholder="Your password"
        />
        <PrimaryButton type="submit" loading={submitting}>
          Log in
        </PrimaryButton>
      </form>
      <p className="text-center text-sm text-subtle">
        New to Sellonit?{' '}
        <Link
          className="font-semibold text-subtle underline underline-offset-2"
          href="/auth/register/phone"
        >
          Create your account
        </Link>
      </p>
    </>
  );
}
