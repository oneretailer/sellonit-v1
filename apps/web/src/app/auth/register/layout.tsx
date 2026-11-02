'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthPage } from '@/components/reuseable/AuthPage';

export default function RegisterLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/auth/register';
  // The account-details screen renders its own page shell (navbar below md, the
  // wordmark inside the card's left panel from md up), so it is not wrapped in
  // AuthPage. Every other sign-up route keeps the shared shell.
  if (pathname.endsWith('/account-details')) {
    return <>{children}</>;
  }
  return <AuthPage rightLink={{ label: 'Sign up', variant: 'text' }}>{children}</AuthPage>;
}
