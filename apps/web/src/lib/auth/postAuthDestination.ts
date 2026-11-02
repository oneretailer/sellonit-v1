import type { Route } from 'next';
import { AUTH_ROUTE, resolveAuthDestination } from './authDestination';
import type { AuthUser } from './types';

/** The user fields the destination needs. */
export type PostAuthUser =
  Pick<AuthUser, 'emailVerifiedAt' | 'onboardingIntent'> | null | undefined;

/**
 * Where to send a user right after a call that establishes the session
 * (login, email verification, password reset).
 *
 * Thin wrapper over `resolveAuthDestination` so success handlers and guards
 * can never disagree. A user who onboarded on another browser already has
 * `onboardingIntent` on the account and goes straight to the dashboard;
 * sessionStorage is not consulted here.
 */
export function getPostAuthDestination(user?: PostAuthUser): Route {
  const destination = resolveAuthDestination({
    status: user ? 'authenticated' : 'unauthenticated',
    user: user ?? null,
  });
  return destination.path ?? AUTH_ROUTE.login;
}
