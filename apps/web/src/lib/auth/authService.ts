/**
 * The only module the auth UI uses for network calls. Components never call
 * fetch or apiFetch directly.
 *
 * - Every call goes through the project's API client (`apiFetch`), so it uses
 *   the same-origin `/api/v1` proxy and the same error handling as the rest of
 *   the app.
 * - Paths come from authEndpoints.ts.
 * - The identifier is sent as the normalized value from identifier.ts. Only
 *   the value changes; the field names of existing endpoints do not.
 * - All API-error-to-UI mapping lives in this file: see the `map*Error`
 *   functions and `authMessageFor`. Adjust those to match backend responses.
 *
 * There is no mock or simulated data in this module.
 */
import { apiFetch, ApiError, NetworkError } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from './authEndpoints';
import type { AuthFlowPurpose } from './flowState';
import type { IdentifierType } from './identifier';
import type { LoginResponse } from './types';

/* ── Messages ──────────────────────────────────────────────────────────── */

/** Every user-facing auth failure message. Shown verbatim by the screens. */
export const AUTH_MESSAGES = {
  failed: 'Something went wrong, please try again',
  wrongCredentials: 'Wrong password, please try again',
  accountNotVerified: "Your account isn't verified yet. Verify it to continue.",
  accountNotFound: 'Account not found',
  wrongCode: 'Wrong code',
  sendFailed: "We couldn't send the code, please try again",
  tokenExpired: 'This reset session has expired. Request a new code to continue.',
  codeRequired: 'Enter the 6-digit code',
} as const;

/**
 * What went wrong, in UI terms. Screens switch on this, never on raw API codes.
 * `failed` covers network errors, server errors (5xx), a missing endpoint (404
 * with no error code) and anything unexpected.
 */
export type AuthFailure =
  | 'wrong-credentials'
  | 'account-not-verified'
  | 'account-not-found'
  | 'wrong-code'
  | 'send-failed'
  | 'token-expired'
  | 'failed';

/** The message for a failure. */
export function authMessageFor(failure: AuthFailure): string {
  switch (failure) {
    case 'wrong-credentials':
      return AUTH_MESSAGES.wrongCredentials;
    case 'account-not-verified':
      return AUTH_MESSAGES.accountNotVerified;
    case 'account-not-found':
      return AUTH_MESSAGES.accountNotFound;
    case 'wrong-code':
      return AUTH_MESSAGES.wrongCode;
    case 'send-failed':
      return AUTH_MESSAGES.sendFailed;
    case 'token-expired':
      return AUTH_MESSAGES.tokenExpired;
    case 'failed':
      return AUTH_MESSAGES.failed;
  }
}

/* ── Request functions ─────────────────────────────────────────────────── */

/**
 * The body field that carries the identifier on the EXISTING login and
 * forgot-password endpoints. The name stays `email`; the value is the email or
 * the 11-digit phone.
 */
const EXISTING_IDENTIFIER_FIELD = 'email' as const;

export type Identified = {
  identifier: string;
  identifierType: IdentifierType;
};

/**
 * Login. On success the API sets the session cookie.
 * Note: the current backend (apps/api) only accepts an email here and rejects a
 * phone with 400 VALIDATION_ERROR. Phone login needs backend support.
 */
export function loginWithIdentifier(
  input: Identified & { password: string },
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(AUTH_ENDPOINTS.login, {
    method: 'POST',
    body: JSON.stringify({
      [EXISTING_IDENTIFIER_FIELD]: input.identifier,
      password: input.password,
    }),
  });
}

/** Sends the password-reset code (existing endpoint). The response body is not used. */
export async function sendResetCode(input: Identified): Promise<void> {
  await apiFetch<unknown>(AUTH_ENDPOINTS.forgotPassword, {
    method: 'POST',
    body: JSON.stringify({ [EXISTING_IDENTIFIER_FIELD]: input.identifier }),
  });
}

/**
 * Sends (or re-sends) a code for a purpose.
 * - reset-password: the existing forgot-password endpoint.
 * - verify-account: the new verification-codes endpoint.
 */
export async function resendCode(input: Identified & { purpose: AuthFlowPurpose }): Promise<void> {
  if (input.purpose === 'reset-password') {
    await sendResetCode(input);
    return;
  }
  await apiFetch<unknown>(AUTH_ENDPOINTS.verificationCodes, {
    method: 'POST',
    body: JSON.stringify({
      identifier: input.identifier,
      identifierType: input.identifierType,
      purpose: input.purpose,
    }),
  });
}

/**
 * Checks a six-digit code. For reset-password the response carries a reset
 * token, which the caller keeps in memory only. A response without the token
 * is treated as a failure by the caller.
 */
export async function verifyCode(
  input: Identified & { purpose: AuthFlowPurpose; code: string },
): Promise<{ resetToken: string | null }> {
  const body = await apiFetch<unknown>(AUTH_ENDPOINTS.verifyCode, {
    method: 'POST',
    body: JSON.stringify({
      identifier: input.identifier,
      identifierType: input.identifierType,
      purpose: input.purpose,
      code: input.code,
    }),
  });
  return { resetToken: readResetToken(body) };
}

function readResetToken(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const token = (data as { resetToken?: unknown }).resetToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** Sets the new password. Expects 204. The token comes from verifyCode. */
export async function resetPassword(input: {
  resetToken: string;
  password: string;
}): Promise<void> {
  await apiFetch<unknown>(AUTH_ENDPOINTS.resetPassword, {
    method: 'POST',
    body: JSON.stringify({ token: input.resetToken, password: input.password }),
  });
}

/* ── Error mapping: API error → AuthFailure (edit here to match the backend) ── */

/** Network failure, server error (5xx), or a missing endpoint (404 without a code). */
function isTransportOrServerFailure(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  return (
    error instanceof ApiError &&
    (error.status >= 500 || (error.status === 404 && error.code === null))
  );
}

/**
 * Login.
 *   INVALID_CREDENTIALS or 401               → wrong-credentials
 *   ACCOUNT_NOT_VERIFIED or EMAIL_NOT_VERIFIED → account-not-verified
 *   anything else                            → failed
 */
export function mapLoginError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.code === 'ACCOUNT_NOT_VERIFIED' || error.code === 'EMAIL_NOT_VERIFIED') {
    return 'account-not-verified';
  }
  if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
    return 'wrong-credentials';
  }
  return 'failed';
}

/**
 * Forgot password (sending the reset code).
 *   USER_NOT_FOUND          → account-not-found
 *   other 4xx with an error → send-failed
 *   anything else           → failed
 */
export function mapSendCodeError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.code === 'USER_NOT_FOUND') {
    return 'account-not-found';
  }
  return 'send-failed';
}

/** Resending a code (either purpose). Any non-server API error is a send failure. */
export function mapResendCodeError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  return 'send-failed';
}

/**
 * Checking a code.
 *   INVALID_CODE, or 400 with no error code → wrong-code
 *   anything else                           → failed
 */
export function mapVerifyCodeError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.code === 'INVALID_CODE' || (error.status === 400 && error.code === null)) {
    return 'wrong-code';
  }
  return 'failed';
}

/**
 * Setting a new password.
 *   INVALID_RESET_TOKEN, RESET_TOKEN_EXPIRED or 401 → token-expired
 *   anything else                                    → failed
 */
export function mapResetPasswordError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (
    error.code === 'INVALID_RESET_TOKEN' ||
    error.code === 'RESET_TOKEN_EXPIRED' ||
    error.status === 401
  ) {
    return 'token-expired';
  }
  return 'failed';
}
