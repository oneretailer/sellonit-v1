/**
 * The only module the auth UI uses for network calls. Components never call
 * fetch or apiFetch directly.
 *
 * - Every call goes through the project's API client (`apiFetch`), so it uses
 *   the same-origin `/api/v1` proxy and the same error handling as the rest of
 *   the app.
 * - Paths come from authEndpoints.ts, which mirrors the backend router.
 * - The identifier is sent as the normalized value from identifier.ts. The
 *   backend validates every auth field as an email address, so a phone
 *   identifier is refused locally with an explanatory message instead of
 *   sending a request that can only fail.
 * - All API-error-to-UI mapping lives in this file: see the `map*Error`
 *   functions and `authMessageFor`. Adjust those to match backend responses.
 *
 * There is no mock or simulated data in this module.
 */
import { apiFetch, ApiError, NetworkError } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from './authEndpoints';
import type { AuthFlowPurpose } from './flowState';
import type { IdentifierType } from './identifier';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyPasswordResetCodeRequest,
  VerifyPasswordResetCodeResponse,
} from './types';

/* ── Messages ──────────────────────────────────────────────────────────── */

/** Every user-facing auth failure message. Shown verbatim by the screens. */
export const AUTH_MESSAGES = {
  failed: 'Something went wrong, please try again',
  wrongCredentials: 'Wrong password, please try again',
  accountNotVerified: "Your account isn't verified yet. Verify it to continue.",
  accountNotFound: 'Account not found',
  accountUnavailable: "This account isn't active. Contact support if you think this is a mistake.",
  emailOnly: "Enter your email address. Phone login and password reset aren't available yet.",
  wrongCode: 'Wrong code',
  sendFailed: "We couldn't send the code, please try again",
  tokenExpired: 'This reset code has expired. Request a new code to continue.',
  verificationLinkRequired:
    'Account verification uses the link we emailed you. Open that link to verify your email.',
  resendUnavailable:
    "Resending verification emails isn't available yet. Check your inbox for the link.",
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
  | 'account-unavailable'
  | 'email-required'
  | 'wrong-code'
  | 'send-failed'
  | 'token-expired'
  | 'verification-link-required'
  | 'resend-unavailable'
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
    case 'account-unavailable':
      return AUTH_MESSAGES.accountUnavailable;
    case 'email-required':
      return AUTH_MESSAGES.emailOnly;
    case 'wrong-code':
      return AUTH_MESSAGES.wrongCode;
    case 'send-failed':
      return AUTH_MESSAGES.sendFailed;
    case 'token-expired':
      return AUTH_MESSAGES.tokenExpired;
    case 'verification-link-required':
      return AUTH_MESSAGES.verificationLinkRequired;
    case 'resend-unavailable':
      return AUTH_MESSAGES.resendUnavailable;
    case 'failed':
      return AUTH_MESSAGES.failed;
  }
}

/* ── Local failures for backend gaps ───────────────────────────────────── */

/**
 * The backend validates every auth identifier as an email address: it has no
 * phone login and sends password-reset codes by email only. Thrown locally so
 * a phone identifier gets an accurate message instead of a server 400.
 */
export class EmailRequiredError extends Error {
  constructor() {
    super('This endpoint accepts an email address only.');
    this.name = 'EmailRequiredError';
  }
}

/**
 * Account verification is link-based (`POST /auth/verify-email-and-login`) and
 * the backend exposes no OTP or resend endpoint for it.
 */
export class VerificationLinkRequiredError extends Error {
  constructor() {
    super('Account verification requires the emailed link.');
    this.name = 'VerificationLinkRequiredError';
  }
}

/** No `POST /auth/resend-verification` route exists yet (backend gap). */
export class ResendUnavailableError extends Error {
  constructor() {
    super('Verification email resend is not available yet.');
    this.name = 'ResendUnavailableError';
  }
}

/* ── Request functions ─────────────────────────────────────────────────── */

/**
 * The body field that carries the identifier. The backend's login, forgot
 * password and reset password handlers all read a field named `email`.
 */
const IDENTIFIER_FIELD = 'email' as const;

export type Identified = {
  identifier: string;
  identifierType: IdentifierType;
};

/**
 * Login. On success the API sets the session cookie.
 * The backend rejects phone identifiers, so those fail here without a request.
 */
export function loginWithIdentifier(
  input: Identified & { password: string },
): Promise<LoginResponse> {
  if (input.identifierType !== 'email') {
    return Promise.reject(new EmailRequiredError());
  }
  return apiFetch<LoginResponse>(AUTH_ENDPOINTS.login, {
    method: 'POST',
    body: JSON.stringify({
      [IDENTIFIER_FIELD]: input.identifier,
      password: input.password,
    }),
  });
}

/**
 * Sends the password-reset code: POST /auth/forgot-password → 202.
 * The backend accepts an email address only; it answers 404 USER_NOT_FOUND for
 * an unknown account and 403 ACCOUNT_UNAVAILABLE for an inactive one.
 */
export function sendResetCode(input: Identified): Promise<void> {
  if (input.identifierType !== 'email') {
    return Promise.reject(new EmailRequiredError());
  }
  const body: ForgotPasswordRequest = { email: input.identifier };
  return apiFetch<ForgotPasswordResponse>(AUTH_ENDPOINTS.forgotPassword, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(() => undefined);
}

/**
 * Sends (or re-sends) a code for a purpose.
 * - reset-password: POST /auth/forgot-password, a fresh 6-digit code.
 * - verify-account: the backend has no account-code or resend route
 *   (`POST /auth/resend-verification` is still a contract gap), so this fails
 *   locally with a message that points the user at the emailed link.
 */
export async function resendCode(input: Identified & { purpose: AuthFlowPurpose }): Promise<void> {
  if (input.purpose === 'reset-password') {
    await sendResetCode(input);
    return;
  }
  throw new ResendUnavailableError();
}

/**
 * Checks the six-digit reset code: POST /auth/verification-codes/verify with
 * `{ identifier, code }`. The backend verifies the code but returns no reset
 * token, so the caller keeps the code in memory and sends it again with the new
 * password (see `resetPassword`).
 */
export async function verifyCode(
  input: Identified & { purpose: AuthFlowPurpose; code: string },
): Promise<void> {
  if (input.purpose !== 'reset-password') {
    throw new VerificationLinkRequiredError();
  }
  if (input.identifierType !== 'email') {
    throw new EmailRequiredError();
  }
  const body: VerifyPasswordResetCodeRequest = {
    identifier: input.identifier,
    code: input.code,
  };
  await apiFetch<VerifyPasswordResetCodeResponse>(AUTH_ENDPOINTS.verifyResetCode, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Sets the new password: POST /auth/reset-password with `{ email, code, password }`.
 * The code is the one verified in the previous step and is re-checked by the
 * backend, which also revokes every existing session.
 */
export async function resetPassword(input: {
  identifier: string;
  code: string;
  password: string;
}): Promise<void> {
  const body: ResetPasswordRequest = {
    [IDENTIFIER_FIELD]: input.identifier,
    code: input.code,
    password: input.password,
  };
  await apiFetch<ResetPasswordResponse>(AUTH_ENDPOINTS.resetPassword, {
    method: 'POST',
    body: JSON.stringify(body),
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
 *   INVALID_CREDENTIALS or 401                → wrong-credentials
 *   EMAIL_NOT_VERIFIED (403)                  → account-not-verified
 *   ACCOUNT_UNAVAILABLE (403)                 → account-unavailable
 *   phone identifier (no request is sent)     → email-required
 *   anything else                             → failed
 */
export function mapLoginError(error: unknown): AuthFailure {
  if (error instanceof EmailRequiredError) {
    return 'email-required';
  }
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.code === 'ACCOUNT_NOT_VERIFIED' || error.code === 'EMAIL_NOT_VERIFIED') {
    return 'account-not-verified';
  }
  if (error.code === 'ACCOUNT_UNAVAILABLE') {
    return 'account-unavailable';
  }
  if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
    return 'wrong-credentials';
  }
  return 'failed';
}

/**
 * Forgot password (sending the reset code).
 *   USER_NOT_FOUND (404)      → account-not-found
 *   ACCOUNT_UNAVAILABLE (403) → account-unavailable
 *   phone identifier          → email-required
 *   other failures            → send-failed (429 / 502 / 503 included)
 */
export function mapSendCodeError(error: unknown): AuthFailure {
  if (error instanceof EmailRequiredError) {
    return 'email-required';
  }
  if (error instanceof ApiError && error.code === 'USER_NOT_FOUND') {
    return 'account-not-found';
  }
  if (error instanceof ApiError && error.code === 'ACCOUNT_UNAVAILABLE') {
    return 'account-unavailable';
  }
  return 'send-failed';
}

/** Resending a code. The verify-account resend has no backend route yet. */
export function mapResendCodeError(error: unknown): AuthFailure {
  if (error instanceof ResendUnavailableError) {
    return 'resend-unavailable';
  }
  if (error instanceof EmailRequiredError) {
    return 'email-required';
  }
  return 'send-failed';
}

/**
 * Checking a code.
 *   INVALID_CODE, or 400 with no error code → wrong-code
 *   verify-account purpose (no route)       → verification-link-required
 *   anything else                           → failed
 */
export function mapVerifyCodeError(error: unknown): AuthFailure {
  if (error instanceof VerificationLinkRequiredError) {
    return 'verification-link-required';
  }
  if (error instanceof EmailRequiredError) {
    return 'email-required';
  }
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
 *   INVALID_CODE (the code is the only credential) → token-expired
 *   anything else                                  → failed
 */
export function mapResetPasswordError(error: unknown): AuthFailure {
  if (isTransportOrServerFailure(error) || !(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.code === 'INVALID_CODE') {
    return 'token-expired';
  }
  return 'failed';
}
