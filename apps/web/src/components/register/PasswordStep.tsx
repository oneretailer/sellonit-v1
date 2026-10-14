'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { isPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

/**
 * Step 3 of registration: password. It is held in memory only and is dropped
 * when the account is created.
 */
export function PasswordStep() {
  const { state, savePassword, goToNextStep } = useRegisterFlow();
  const [password, setPassword] = useState(state.password ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPassword(password)) {
      setError(
        `Use between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters for your password.`,
      );
      return;
    }
    savePassword(password);
    goToNextStep('password');
  }

  return (
    <AuthCard>
      <StepHeader title="Create a password">
        Use at least {MIN_PASSWORD_LENGTH} characters.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
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
