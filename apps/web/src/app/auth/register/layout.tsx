'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthPage } from '@/components/reuseable/AuthPage';

export default function RegisterLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const label = pathname.endsWith('/account-details') ? 'Account details' : 'Sign up';
  return <AuthPage rightLink={{ label, variant: 'text' }}>{children}</AuthPage>;
}
