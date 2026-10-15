'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { login } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';
import { useLoginFlow } from './LoginFlowProvider';

/**
 * Login step 2: password. Submitting calls POST /auth/login. The API sets the
 * session cookie, and the app then goes to /account.
 */
export function LoginPasswordStep() {
  const router = useRouter();
  const { state, goToStep } = useLoginFlow();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const email = state.email ?? '';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (password.length === 0) {
      setError('Enter your password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    login({ email, password })
      .then(() => {
        router.replace('/account');
      })
      .catch((err: unknown) => {
        setSubmitting(false);
        setError(authErrorMessage(err));
      });
  }

  return (
    <AuthCard>
      <StepHeader title="Enter your password">Logging in as {email}.</StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        {error ? <InlineError>{error}</InlineError> : null}
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError(null);
          }}
          disabled={submitting}
        />

        <PrimaryButton type="submit" loading={submitting}>
          Log in
        </PrimaryButton>
      </form>

      <div className="flex w-full flex-col gap-4">
        {/* TODO(backend): forgot-password. The page is a "coming soon" placeholder with no API call. See app/auth/forgot-password. */}
        <Link
          href="/auth/forgot-password"
          className="text-sm font-semibold text-subtle underline underline-offset-2"
        >
          Forgot password?
        </Link>
        <button
          type="button"
          onClick={() => goToStep('email')}
          disabled={submitting}
          className="text-sm font-semibold text-subtle underline underline-offset-2 disabled:opacity-60"
        >
          Use a different email
        </button>
      </div>
    </AuthCard>
  );
}
