import type { Metadata } from 'next';
import { StepHeader } from '@/components/auth/StepHeader';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Password reset is coming soon.',
};

/**
 * TODO(backend): forgot-password. Not implemented in apps/api yet. The endpoints
 * exist only in docs/openapi.yaml:
 *   POST /api/v1/auth/forgot-password  { email }                 -> 202
 *   POST /api/v1/auth/reset-password   { token, password }       -> 204
 * Until both are implemented this page makes no API call and must not say that
 * an email was sent.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthPage rightLink={{ label: 'Log in', href: '/auth/login/email' }}>
      <AuthCard>
        <StepHeader title="Forgot password">
          Password reset is coming soon. We cannot send reset emails yet.
        </StepHeader>
        <PrimaryLinkButton href="/auth/login/email">Back to log in</PrimaryLinkButton>
      </AuthCard>
    </AuthPage>
  );
}
