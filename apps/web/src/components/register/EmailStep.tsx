'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { resolveEmailStep } from '@/lib/auth/emailCheck';
import { EMAIL_EXISTS_NOTICE, loginEmailPath } from '@/lib/auth/existingAccount';
import { isEmail } from '@/lib/auth/validation';
import { useDelayedLoginRedirect } from './useDelayedLoginRedirect';
import { useRegisterFlow } from './RegisterFlowContext';

/**
 * Step 2 of registration: email address.
 *
 * Continues straight to the password step while the email-exists check is
 * disabled (see lib/auth/emailCheck.ts). When the check is enabled, the button
 * shows its loading state while it runs. An existing account sends the user to
 * log in with the email prefilled. A failed check shows an error and does not
 * continue.
 */
export function EmailStep() {
  const { state, saveEmail, goToNextStep } = useRegisterFlow();
  const redirectToLogin = useDelayedLoginRedirect();
  const [email, setEmail] = useState(state.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitEmail();
  }

  async function submitEmail() {
    if (checking || notice !== null) {
      return;
    }
    if (!isEmail(email)) {
      setError('Enter a valid email address, such as name@example.com.');
      return;
    }
    setError(null);
    setChecking(true);
    const result = await resolveEmailStep(email);
    if (result.kind === 'error') {
      setChecking(false);
      setError(result.message);
      return;
    }
    if (result.kind === 'exists') {
      setNotice(EMAIL_EXISTS_NOTICE);
      redirectToLogin(loginEmailPath(result.email));
      return;
    }
    saveEmail(result.email);
    goToNextStep('email');
  }

  return (
    <AuthCard>
      <StepHeader title="What is your email address?">
        We will send a verification link to this address.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        {notice ? <InlineError>{notice}</InlineError> : null}
        <TextField
          id="email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setError(null);
          }}
          error={error}
        />

        <PrimaryButton type="submit" loading={checking}>
          Continue
        </PrimaryButton>
      </form>

      <AuthSwitchPrompt
        question="Already have an account?"
        label="Log in"
        href="/auth/login/email"
      />
    </AuthCard>
  );
}
