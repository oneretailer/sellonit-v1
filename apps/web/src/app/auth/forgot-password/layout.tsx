import type { ReactNode } from 'react';
import { ForgotPasswordFlowProvider } from '@/components/password-reset/FlowProvider';
import { AuthPage } from '@/components/reuseable/AuthPage';

/**
 * Shared shell for the forgot-password steps. The provider keeps the in-memory
 * reset token between steps. It is not stored, so a refresh clears it on
 * purpose.
 */
export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return (
    <ForgotPasswordFlowProvider>
      <AuthPage rightLink={{ label: 'Login', href: '/auth/login' }}>{children}</AuthPage>
    </ForgotPasswordFlowProvider>
  );
}
