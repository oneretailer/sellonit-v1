'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { isName, NAME_MAX_LENGTH } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

type NameErrors = { firstName?: string; lastName?: string };

/** Step 1 of registration: first and last name. Nothing is sent to the API yet. */
export function NameStep() {
  const { state, saveName, goToNextStep } = useRegisterFlow();
  // Initialised from the store, so going back to this step keeps the typed values.
  const [firstName, setFirstName] = useState(state.firstName ?? '');
  const [lastName, setLastName] = useState(state.lastName ?? '');
  const [errors, setErrors] = useState<NameErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: NameErrors = {};
    if (!isName(firstName)) {
      next.firstName = `Enter your first name (up to ${NAME_MAX_LENGTH} characters).`;
    }
    if (!isName(lastName)) {
      next.lastName = `Enter your last name (up to ${NAME_MAX_LENGTH} characters).`;
    }
    setErrors(next);
    if (next.firstName || next.lastName) {
      return;
    }
    saveName(firstName.trim(), lastName.trim());
    goToNextStep('name');
  }

  return (
    <AuthCard>
      <StepHeader title="Create your account">Enter your name to get started.</StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-4">
          <TextField
            id="firstName"
            label="First name"
            autoComplete="given-name"
            value={firstName}
            onChange={(value) => {
              setFirstName(value);
              setErrors((current) => ({ ...current, firstName: undefined }));
            }}
            error={errors.firstName}
          />
          <TextField
            id="lastName"
            label="Last name"
            autoComplete="family-name"
            value={lastName}
            onChange={(value) => {
              setLastName(value);
              setErrors((current) => ({ ...current, lastName: undefined }));
            }}
            error={errors.lastName}
          />
        </div>

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
