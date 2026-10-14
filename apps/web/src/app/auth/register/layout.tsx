import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';
import { RegisterFlowProvider } from '@/components/register/RegisterFlowProvider';

/**
 * Shared layout for the registration steps. The provider keeps the data
 * collected across steps mounted, and every step shows the same navbar.
 */
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <RegisterFlowProvider>
      <AuthPage rightLink={{ label: 'Create account', href: '/auth/register/name' }}>
        {children}
      </AuthPage>
    </RegisterFlowProvider>
  );
}
