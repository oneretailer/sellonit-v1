'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RedirectAuthenticatedUser } from './RedirectAuthenticatedUser';

/**
 * Routes that own their session transitions instead of being redirected by the
 * public-page gate:
 * - `/auth/role-selection` (and the account-created success screen) use
 *   RequireAuthenticatedSession.
 * - `/auth/verify-email/confirm` verifies the link then navigates.
 * - `/auth/verify-email` polls `/auth/me`, shows the "Email verified" state and
 *   then navigates, so it must not be redirected the moment a cookie appears.
 */
const ROUTES_WITH_OWN_SESSION_HANDLING = new Set([
  '/auth/role-selection',
  '/auth/verify-email',
  '/auth/verify-email/confirm',
]);

/** Keeps token-confirmation and guarded onboarding routes on their own flows. */
export function AuthenticatedAuthRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/auth';
  if (ROUTES_WITH_OWN_SESSION_HANDLING.has(pathname)) return children;

  return <RedirectAuthenticatedUser locationKey={pathname}>{children}</RedirectAuthenticatedUser>;
}
