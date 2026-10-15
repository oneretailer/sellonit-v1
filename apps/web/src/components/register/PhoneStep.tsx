'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { AuthSwitchPrompt } from '@/components/reuseable/AuthSwitchPrompt';
import { PhoneField } from '@/components/reuseable/PhoneField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { register } from '@/lib/auth/api';
import { registerErrorMessage } from '@/lib/auth/errors';
import {
  EMAIL_EXISTS_NOTICE,
  loginEmailPath,
  registerFailureAction,
} from '@/lib/auth/existingAccount';
import { isNigerianPhoneDigits, normalizePhoneInput, toLocalPhone } from '@/lib/auth/validation';
import { useRegisterFlow } from './RegisterFlowContext';
import { useDelayedLoginRedirect } from './useDelayedLoginRedirect';
import type { RegisterFlowState } from './registerFlowReducer';

const HELPER_ID = 'phone-helper';
const ERROR_ID = 'phone-error';

/**
 * Step 4 of registration: the optional phone number. This is the step that
 * creates the account: POST /auth/register is sent from here, with every
 * detail collected so far. A phone number makes the API send an SMS code, so
 * the next step is the code screen. "Skip for now" creates the account
 * without a phone number.
 */
export function PhoneStep() {
  const { state, savePhone, markRegistered, goToNextStep } = useRegisterFlow();
  const redirectToLogin = useDelayedLoginRedirect();
  // Initialised from the store, so going back here keeps the number typed earlier.
  const [digits, setDigits] = useState(state.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { firstName, lastName, email, password } = state;
  const ready = firstName !== null && lastName !== null && email !== null && password !== null;
  const alreadyRegistered = state.registered !== null;

  // The account already exists (e.g. the user came back to this step after
  // registering). Do not offer to create it again: continue to the next step.
  useEffect(() => {
    if (alreadyRegistered) {
      goToNextStep('phone');
    }
  }, [alreadyRegistered, goToNextStep]);

  async function createAccount(phone: string | null) {
    if (submitting || !ready) {
      return;
    }
    setError(null);
    setSubmitting(true);
    savePhone(phone);
    try {
      const response = await register({
        email,
        password,
        firstName,
        lastName,
        ...(phone ? { phone: toLocalPhone(phone) } : {}),
      });
      const account = {
        email,
        phone,
        // DEV-ONLY-REMOVE: present only in non-production builds. See DevEmailVerificationPanel.
        ...(response.emailVerificationToken
          ? { devEmailVerificationToken: response.emailVerificationToken }
          : {}),
      };
      markRegistered(account);
      // Pass the new state explicitly: it is not yet in this render's state.
      const nextState: RegisterFlowState = {
        ...state,
        phone,
        password: null,
        registered: account,
        phoneVerified: false,
      };
      goToNextStep('phone', nextState);
    } catch (err) {
      // 409 EMAIL_ALREADY_EXISTS: the email is registered. The fallback when the
      // email-exists check is disabled. Keep the spinner until the redirect.
      if (registerFailureAction(err).kind === 'account-exists') {
        setError(EMAIL_EXISTS_NOTICE);
        redirectToLogin(loginEmailPath(email));
        return;
      }
      setSubmitting(false);
      setError(registerErrorMessage(err));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isNigerianPhoneDigits(digits)) {
      setError(
        digits.length === 0
          ? 'Enter your phone number, or choose Skip for now.'
          : 'Enter a valid Nigerian phone number.',
      );
      inputRef.current?.focus();
      return;
    }
    void createAccount(digits);
  }

  if (alreadyRegistered) {
    return null;
  }

  return (
    <AuthCard>
      <StepHeader title="Add your phone number">
        We will use this phone number to verify your account and send you important account updates.
      </StepHeader>

      <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <div className="flex w-full flex-col gap-3 text-left">
          <PhoneField
            id="phone"
            inputRef={inputRef}
            value={digits}
            onChange={(value) => {
              setDigits(normalizePhoneInput(value));
              setError(null);
            }}
            error={error !== null}
            aria-describedby={error ? ERROR_ID : HELPER_ID}
            maxLength={14}
            disabled={submitting}
          />
          {error ? <InlineError id={ERROR_ID}>{error}</InlineError> : null}
        </div>

        <div className="flex w-full flex-col gap-4">
          <PrimaryButton type="submit" loading={submitting}>
            Create account
          </PrimaryButton>
          <button
            type="button"
            onClick={() => void createAccount(null)}
            disabled={submitting}
            className="text-sm font-semibold text-subtle underline underline-offset-2 disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>
      </form>

      <AuthSwitchPrompt
        question="Already have an account?"
        label="Log in"
        href="/auth/login/email"
      />
    </AuthCard>
  );
}
