import type { ReactNode } from 'react';
import { LoginFlowProvider } from '@/components/login/LoginFlowProvider';
import { AuthPage } from '@/components/reuseable/AuthPage';

/** Shared layout for the login steps. Same navbar as the registration steps. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <LoginFlowProvider>
      <AuthPage rightLink={{ label: 'Create account', href: '/auth/register/name' }}>
        {children}
      </AuthPage>
    </LoginFlowProvider>
  );
}
