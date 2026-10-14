'use client';

import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { DevEmailVerificationPanel } from './DevEmailVerificationPanel';
import { useRegisterFlow } from './RegisterFlowContext';

/**
 * Last registration step: the account exists and the verification link was
 * emailed. Login is blocked until the email is verified (the API returns
 * EMAIL_NOT_VERIFIED), so the user must open the link first.
 */
export function CheckEmailStep() {
  const { state } = useRegisterFlow();
  const account = state.registered;
  if (account === null) {
    return null;
  }

  return (
    <AuthCard>
      <StepHeader title="Check your email">
        We sent a verification link to {account.email}. Open it to verify your email address, then
        log in.
      </StepHeader>

      <PrimaryLinkButton href="/auth/login">Log in</PrimaryLinkButton>

      {/* DEV-ONLY-REMOVE: renders only outside production and only when the API returned a token. */}
      {account.devEmailVerificationToken ? (
        <DevEmailVerificationPanel token={account.devEmailVerificationToken} />
      ) : null}
    </AuthCard>
  );
}
