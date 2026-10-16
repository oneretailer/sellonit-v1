import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';

/**
 * Shared shell for Create account (and the legacy step URLs that redirect
 * into it). Logged-out header: logo top-left, "Login" link top-right. The
 * "Account details" label is a logged-in header and is not shown here.
 */
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <AuthPage rightLink={{ label: 'Login', href: '/auth/login' }}>{children}</AuthPage>;
}
