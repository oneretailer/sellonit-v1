import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';

/**
 * Shared shell for Create account (and the legacy step URLs that redirect
 * into it). Figma "account details" frame: logo top-left, plain "Account
 * details" text top-right (not a link, hence no href).
 */
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <AuthPage rightLink={{ label: 'Account details', variant: 'text' }}>{children}</AuthPage>;
}
