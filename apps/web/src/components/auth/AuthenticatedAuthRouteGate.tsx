'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RedirectAuthenticatedUser } from './RedirectAuthenticatedUser';

const ROUTES_WITH_OWN_SESSION_HANDLING = new Set([
  '/auth/welcome',
  '/auth/role-selection',
  '/auth/verify-email/confirm',
]);

/** Keeps token-confirmation and guarded onboarding routes on their own flows. */
export function AuthenticatedAuthRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/auth';
  if (ROUTES_WITH_OWN_SESSION_HANDLING.has(pathname)) return children;

  return <RedirectAuthenticatedUser locationKey={pathname}>{children}</RedirectAuthenticatedUser>;
}
