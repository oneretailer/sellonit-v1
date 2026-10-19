import type { ReactNode } from 'react';
import { AuthPage } from '@/components/reuseable/AuthPage';

/** Login shell: logo top-left, plain "Login" text top-right (no link on the login page itself). */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthPage rightLink={{ label: 'Login', variant: 'text' }}>{children}</AuthPage>;
}
