'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import {
  NAME_INVALID_CHARACTERS_MESSAGE,
  NAME_MAX_LENGTH,
  sanitizeNameInput,
  validateNameStep,
  type NameStepErrors,
} from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

/**
 * Step 1 of registration: first and last name. Nothing is sent to the API yet.
 *
 * As the user types, each field keeps letters, spaces, hyphens and apostrophes
 * only (everything else is stripped and flagged with a friendly message) and
 * capitalizes the first letter of every name part. Submit re-checks both
 * fields and shows a specific message per field.
 */
export function NameStep() {
  const { state, saveName, goToNextStep } = useRegisterFlow();
  // Initialised from the store, so going back to this step keeps the typed values.
  const [firstName, setFirstName] = useState(state.firstName ?? '');
  const [lastName, setLastName] = useState(state.lastName ?? '');
  const [errors, setErrors] = useState<NameStepErrors>({});

  /** Applies the name rules to one field and reports stripped characters inline. */
  function handleNameChange(
    field: keyof NameStepErrors,
    raw: string,
    setValue: (value: string) => void,
  ) {
    const { value, removedInvalidCharacters } = sanitizeNameInput(raw);
    setValue(value);
    setErrors((current) => ({
      ...current,
      [field]: removedInvalidCharacters ? NAME_INVALID_CHARACTERS_MESSAGE : undefined,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateNameStep(firstName, lastName);
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
            maxLength={NAME_MAX_LENGTH}
            value={firstName}
            onChange={(value) => handleNameChange('firstName', value, setFirstName)}
            error={errors.firstName}
          />
          <TextField
            id="lastName"
            label="Last name"
            autoComplete="family-name"
            maxLength={NAME_MAX_LENGTH}
            value={lastName}
            onChange={(value) => handleNameChange('lastName', value, setLastName)}
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
