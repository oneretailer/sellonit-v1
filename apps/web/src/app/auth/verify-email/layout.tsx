import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';

export default function VerifyEmailLayout({ children }: { children: ReactNode }) {
  return <AuthPage>{children}</AuthPage>;
}
