'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { isEmail } from '@/lib/auth/validation';
import { useLoginFlow } from './LoginFlowProvider';
import type { LoginStepProps } from './loginSteps';

/** Login step 1: email address. */
export function LoginEmailStep({ initialEmail }: LoginStepProps) {
  const { state, saveEmail, goToStep } = useLoginFlow();
  const [email, setEmail] = useState(state.email ?? initialEmail ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    saveEmail(email.trim());
    goToStep('password');
  }

  return (
    <AuthCard>
      <StepHeader title="Log in">Welcome back. Enter your email address to continue.</StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
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
        question="New to Sellonit?"
        label="Create your account"
        href="/auth/register/name"
      />
    </AuthCard>
  );
}
