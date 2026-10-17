'use client';

import { useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { register } from '@/lib/auth/api';
import { registerErrorMessage } from '@/lib/auth/errors';
import { EMAIL_EXISTS_NOTICE, registerFailureAction } from '@/lib/auth/existingAccount';
import { TextField } from '@/components/reuseable/TextField';
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordStep,
  type PasswordStepErrors,
} from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';

/**
 * Step 3 of registration: password and its confirmation.
 *
 * Only the password is stored in the flow state. The confirmation lives in this
 * component and is dropped when the step unmounts. The mismatch message shows on
 * blur or submit, not on every keystroke.
 */
export function PasswordStep() {
  const { state, savePassword, markRegistered, goToNextStep } = useRegisterFlow();
  // Initialised from the store, so going back here keeps the password typed earlier.
  const [password, setPassword] = useState(state.password ?? '');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordStepErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function handleConfirmBlur() {
    if (confirm.length > 0 && confirm !== password) {
      setErrors((current) => ({ ...current, confirm: 'Passwords do not match.' }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validatePasswordStep(password, confirm);
    setErrors(next);
    if (next.password || next.confirm) {
      return;
    }
    if (!state.firstName || !state.lastName || !state.email || submitting) {
      return;
    }
    const { firstName, lastName, email } = state;
    setSubmitting(true);
    void register({
      email,
      password,
      firstName,
      lastName,
    })
      .then((response) => {
        const account = {
          email,
          phone: null,
          ...(response.emailVerificationToken
            ? { devEmailVerificationToken: response.emailVerificationToken }
            : {}),
        };
        savePassword(password);
        markRegistered(account);
        goToNextStep('password', {
          ...state,
          password: null,
          phone: null,
          registered: account,
        });
      })
      .catch((error: unknown) => {
        if (registerFailureAction(error).kind === 'account-exists') {
          setErrors({ password: EMAIL_EXISTS_NOTICE });
        } else {
          setErrors({ password: registerErrorMessage(error) });
        }
        setSubmitting(false);
      });
  }

  return (
    <AuthCard>
      <StepHeader title="Create a password">
        Use at least {MIN_PASSWORD_LENGTH} characters.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-4">
          <TextField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            error={errors.password}
          />
          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setErrors((current) => ({ ...current, confirm: undefined }));
            }}
            onBlur={handleConfirmBlur}
            error={errors.confirm}
          />
        </div>

        <PrimaryButton type="submit" loading={submitting}>
          Create account
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
