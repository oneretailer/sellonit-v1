'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { TextField } from '@/components/reuseable/TextField';
import {
  AUTH_MESSAGES,
  authMessageFor,
  mapResendCodeError,
  mapVerifyCodeError,
  resendCode,
  verifyCode,
} from '@/lib/auth/authService';
import { maskIdentifier } from '@/lib/auth/identifier';
import {
  clearAuthFlow,
  resendAvailableAfterSend,
  type AuthFlowPurpose,
} from '@/lib/auth/flowState';
import { getPostAuthDestination } from '@/lib/auth/postAuthDestination';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { useForgotPasswordFlow } from './FlowProvider';
import { useStoredAuthFlow } from './useStoredAuthFlow';

/** Where a user goes if this step is opened without a saved flow for it. */
function startPathFor(purpose: AuthFlowPurpose): '/auth/forgot-password' | '/auth/login' {
  return purpose === 'reset-password' ? '/auth/forgot-password' : '/auth/login';
}

/**
 * "Resend code" with its countdown. The countdown target is kept in sessionStorage
 * (resendAvailableAt), so a refresh does not reset the cooldown. The parent
 * keys this component by the target, so each new target starts from a fresh,
 * correct clock.
 */
function ResendCodeButton({
  availableAt,
  disabled,
  loading,
  onResend,
}: {
  availableAt: number | null;
  disabled: boolean;
  loading: boolean;
  onResend: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (availableAt === null) {
      return;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= availableAt) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [availableAt]);

  const secondsLeft = availableAt === null ? 0 : Math.max(0, Math.ceil((availableAt - now) / 1000));
  return (
    <SecondaryButton onClick={onResend} disabled={disabled || secondsLeft > 0} loading={loading}>
      {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
    </SecondaryButton>
  );
}

/**
 * Enter verification code (Figma: Enter verification code, Wrong code). Used
 * for both purposes:
 * - reset-password: a verified code returns a reset token (held in memory)
 *   and the user moves to the new-password step.
 * - verify-account: a verified code finishes verification and routes through
 *   the shared post-auth onboarding gate.
 *
 * The code is never stored. A refresh empties the input, as intended.
 */
export function CodeForm({ purpose }: { purpose: AuthFlowPurpose }) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const resetFlow = useForgotPasswordFlow();
  const [flow, updateFlow] = useStoredAuthFlow();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inFlight = useRef(false);
  // Set just before a successful finish. Clearing the flow then must not trigger the guard.
  const finishing = useRef(false);

  const resendAt = flow?.resendAvailableAt ?? null;
  const busy = submitting || resending;

  // Guard: no saved flow for this purpose means there is nothing to verify.
  useEffect(() => {
    if (flow === undefined || finishing.current) {
      return;
    }
    if (flow === null || flow.purpose !== purpose) {
      router.replace(startPathFor(purpose));
    }
  }, [flow, purpose, router]);

  if (!flow || flow.purpose !== purpose) {
    return null;
  }

  const maskedTo = maskIdentifier(flow.identifier, flow.identifierType);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !flow) {
      return;
    }
    // An incomplete code cannot be correct: report it without calling the API.
    if (code.length === 0) {
      setCodeError(AUTH_MESSAGES.codeRequired);
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setCodeError(authMessageFor('wrong-code'));
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setCodeError(null);
    setFormError(null);
    setNotice(null);
    try {
      const result = await verifyCode({
        identifier: flow.identifier,
        identifierType: flow.identifierType,
        purpose,
        code,
      });
      if (purpose === 'reset-password') {
        const token = result.resetToken;
        if (!token || !resetFlow) {
          throw new Error('Reset token missing from verification response');
        }
        resetFlow.setResetToken(token);
        updateFlow({ step: 'new-password' });
        router.push('/auth/forgot-password/new-password');
      } else {
        // Existing post-verification behaviour (see VerifyEmailConfirm).
        const authenticatedUser = await refreshSession();
        if (!authenticatedUser) throw new Error('Session was not established after verification.');
        finishing.current = true;
        clearAuthFlow();
        router.replace(getPostAuthDestination());
      }
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      const failure = mapVerifyCodeError(error);
      if (failure === 'wrong-code') {
        setCodeError(authMessageFor(failure));
      } else {
        setFormError(authMessageFor(failure));
      }
    }
  }

  async function handleResend() {
    const current = flow;
    if (!current || busy) {
      return;
    }
    setResending(true);
    setFormError(null);
    setNotice(null);
    try {
      await resendCode({
        identifier: current.identifier,
        identifierType: current.identifierType,
        purpose,
      });
      updateFlow({ resendAvailableAt: resendAvailableAfterSend() });
      setNotice('A new code has been sent.');
    } catch (error) {
      setFormError(authMessageFor(mapResendCodeError(error)));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthCard gapClassName="gap-9">
      <StepHeader title="Enter verification code" align="left" icon={<BagMark />}>
        {`We sent a code to ${maskedTo}`}
      </StepHeader>

      <form
        className="flex w-full flex-col gap-6 text-left"
        onSubmit={(event) => void handleVerify(event)}
        noValidate
      >
        <div className="flex w-full flex-col gap-2">
          <TextField
            id="code"
            label="Code"
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setCodeError(null);
              setFormError(null);
            }}
            error={codeError}
            disabled={busy}
          />
          {flow.identifierType === 'email' ? (
            <p className="text-sm text-subtle">Check your spam folder</p>
          ) : null}
        </div>

        {/* Live region for the resend result and any error, shown under the buttons. */}
        <div aria-live="polite" className="flex flex-col gap-2">
          {notice ? <p className="text-sm text-success">{notice}</p> : null}
          {formError ? <InlineError>{formError}</InlineError> : null}
        </div>

        <div className="flex w-full flex-col gap-3">
          <PrimaryButton type="submit" loading={submitting} disabled={resending}>
            Verify code
          </PrimaryButton>
          <ResendCodeButton
            key={resendAt ?? 'idle'}
            availableAt={resendAt}
            disabled={busy}
            loading={resending}
            onResend={() => void handleResend()}
          />
        </div>
      </form>
    </AuthCard>
  );
}
