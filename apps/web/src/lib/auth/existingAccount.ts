/**
 * Handling for "this email already has an account".
 *
 * Two places can find out: the email step (when the check is enabled) and the
 * phone step (POST /auth/register returns 409 EMAIL_ALREADY_EXISTS). Both send
 * the user to log in with the email prefilled. The password is never part of
 * that URL or any shared state.
 */
import type { Route } from 'next';
import { ApiError } from '@/lib/api-client';

export const EMAIL_EXISTS_NOTICE =
  'An account with this email already exists. Taking you to log in...';

/** Time the notice stays on screen before navigating to login. */
export const LOGIN_REDIRECT_DELAY_MS = 1500;

/** Login email step with the email prefilled. Only the email goes in the query string. */
export function loginEmailPath(email: string): Route {
  return `/auth/login/email?email=${encodeURIComponent(email)}` as Route;
}

export type RegisterFailure = { kind: 'account-exists' } | { kind: 'other' };

/** Classifies a failed POST /auth/register. */
export function registerFailureAction(error: unknown): RegisterFailure {
  if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_EXISTS') {
    return { kind: 'account-exists' };
  }
  return { kind: 'other' };
}
