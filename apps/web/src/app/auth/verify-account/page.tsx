import type { Metadata } from 'next';
import { CodeForm } from '@/components/password-reset/CodeForm';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Verify your account',
};

/**
 * Verify account (Screen G, purpose "verify-account"). Reached from the
 * unverified-account notice on the login screen. Requires a saved flow for
 * this purpose.
 */
export default function VerifyAccountPage() {
  return (
    <div className="pt-15 w-full flex items-center justify-center">
      <AuthPage rightLink={{ label: 'Login', href: '/auth/login' }}>
        <CodeForm purpose="verify-account" />
      </AuthPage>
    </div>
  );
}
