'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { isEmail } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

/** Step 2 of registration: email address. The verification link is sent after the phone step. */
export function EmailStep() {
  const { state, saveEmail, goToNextStep } = useRegisterFlow();
  const [email, setEmail] = useState(state.email ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError('Enter a valid email address, such as name@example.com.');
      return;
    }
    const normalised = email.trim().toLowerCase();
    saveEmail(normalised);
    goToNextStep('email');
  }

  return (
    <AuthCard>
      <StepHeader title="What is your email address?">
        We will send a verification link to this address.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
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

        <PrimaryButton type="submit">Continue</PrimaryButton>
      </form>

      <AuthSwitchPrompt
        question="Already have an account?"
        label="Log in"
        href="/auth/login/email"
      />
    </AuthCard>
  );
}
