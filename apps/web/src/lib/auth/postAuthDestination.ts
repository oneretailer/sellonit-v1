import type { Route } from 'next';
import {
  AUTH_ROUTE,
  resolveAuthDestination,
  type AuthWorkspaceSnapshot,
} from './authDestination';
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
 * `onboardingIntent` on the account and goes straight to the dashboard; a
 * platform administrator without an onboarding intent goes to `/admin/suppliers`.
 */
export function getPostAuthDestination(
  user?: PostAuthUser,
  workspace?: AuthWorkspaceSnapshot,
): Route {
  const destination = resolveAuthDestination({
    status: user ? 'authenticated' : 'unauthenticated',
    user: user ?? null,
    workspace,
  });
  return destination.path ?? AUTH_ROUTE.login;
}
