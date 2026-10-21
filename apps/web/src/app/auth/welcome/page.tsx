import type { Metadata } from 'next';
import { AccountCreatedSuccess } from '@/components/onboarding/AccountCreatedSuccess';
import { RequireAuthenticatedSession } from '@/components/auth/RequireAuthenticatedSession';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Account successfully created',
  description: 'Your Sellonit account is ready to set up.',
};

/** Standalone authenticated success route, reusable by future OAuth sign-up flows. */
export default function AccountWelcomePage() {
  return (
    <AuthPage rightLink={{ label: 'Account details', variant: 'text', className: 'text-base' }}>
      <RequireAuthenticatedSession>
        <AccountCreatedSuccess />
      </RequireAuthenticatedSession>
    </AuthPage>
  );
}
