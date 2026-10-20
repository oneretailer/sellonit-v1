'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PasswordField } from '@/components/reuseable/PasswordField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { authMessageFor, mapResetPasswordError, resetPassword } from '@/lib/auth/authService';
import { clearAuthFlow } from '@/lib/auth/flowState';
import {
  confirmError,
  isConfirmMatching,
  isPasswordValid,
  PASSWORD_RULES,
} from '@/lib/validation/auth';
import { useForgotPasswordFlow } from './FlowProvider';
import { useStoredAuthFlow } from './useStoredAuthFlow';

/**
 * Create a new password (Figma: Create a new password, Password mismatch).
 *
 * Both passwords stay in component state only. Neither is stored, logged or
 * kept in the URL. The reset token is read from the in-memory flow context. If
 * it is missing (for example after a refresh), the user goes back to the code
 * step with the identifier still filled in.
 */
export function NewPasswordForm() {
  const router = useRouter();
  const resetFlow = useForgotPasswordFlow();
  const [flow, updateFlow] = useStoredAuthFlow();
  const token = resetFlow?.resetToken ?? null;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  // Set just before a successful finish, so clearing the flow does not trigger the guard.
  const finishing = useRef(false);

  // Guards: no saved flow → start over; no token in memory → back to the code step.
  useEffect(() => {
    if (flow === undefined || finishing.current) {
      return;
    }
    if (flow === null || flow.purpose !== 'reset-password') {
      router.replace('/auth/forgot-password');
      return;
    }
    if (!token) {
      updateFlow({ step: 'verify' });
      router.replace('/auth/forgot-password/verify');
    }
  }, [flow, token, router, updateFlow]);

  if (!flow || flow.purpose !== 'reset-password' || !token) {
    return null;
  }

  const rulesMet = isPasswordValid(password);
  const canSubmit = rulesMet && isConfirmMatching(password, confirm);
  const mismatch = confirmError(password, confirm);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit || !token) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    setTokenExpired(false);
    try {
      // Password is sent exactly as typed (never trimmed).
      await resetPassword({ resetToken: token, password });
      finishing.current = true;
      resetFlow?.setResetToken(null);
      resetFlow?.markCompleted();
      clearAuthFlow();
      router.push('/auth/forgot-password/success');
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      const failure = mapResetPasswordError(error);
      setTokenExpired(failure === 'token-expired');
      setFormError(authMessageFor(failure));
    }
  }

  function requestNewCode() {
    resetFlow?.setResetToken(null);
    updateFlow({ step: 'verify' });
    router.push('/auth/forgot-password/verify');
  }

  return (
    <AuthCard gapClassName="gap-9">
      <StepHeader title="Create a new password" align="left" icon={<BagMark />}>
        Choose a new password for your sellonit account
      </StepHeader>

      <form
        className="flex w-full flex-col gap-6 text-left"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <div className="flex w-full flex-col gap-3">
          <PasswordField
            id="password"
            label="Password"
            placeholder="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(value) => {
              setPassword(value);
              setFormError(null);
            }}
            describedBy="password-rules"
            disabled={submitting}
          />
          <ul id="password-rules" className="flex flex-col gap-2 pl-1">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 text-sm ${met ? 'text-success' : 'text-[#6B7280]'}`}
                >
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
                  <span>{rule.label}</span>
                  <span className="sr-only">{met ? 'requirement met' : 'requirement not met'}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(value) => setConfirm(value)}
          error={mismatch}
          disabled={submitting}
        />

        {formError ? (
          <div className="flex flex-col gap-2">
            <InlineError>{formError}</InlineError>
            {tokenExpired ? (
              <button
                type="button"
                onClick={requestNewCode}
                className="flex items-center gap-1.5 self-start text-sm font-semibold text-subtle underline underline-offset-2 hover:text-ink"
              >
                Request a new code
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-3">
          <PrimaryButton type="submit" loading={submitting} disabled={!canSubmit}>
            Reset password
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}
