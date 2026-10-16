/**
 * Every auth endpoint path the web app calls, in one place.
 *
 * Paths are relative to the same-origin API base `/api/v1` (see api-client.ts).
 * To change a path, edit one line here. Nothing else needs to change.
 */
export const AUTH_ENDPOINTS = {
  /**
   * EXISTING. POST. Body: `{ "email": "<email or 11-digit phone>", "password": "…" }`.
   * The field name stays `email` for both identifier types.
   */
  login: '/auth/login',

  /**
   * EXISTING (docs/openapi.yaml). POST. Body: `{ "email": "<email or 11-digit phone>" }`.
   * Sends the password-reset code. Also used to resend that code.
   */
  forgotPassword: '/auth/forgot-password',

  /**
   * EXISTING (docs/openapi.yaml). POST. Body: `{ "token": "<reset token>", "password": "…" }`.
   */
  resetPassword: '/auth/reset-password',

  /**
   * NEW. POST. Body: `{ "identifier", "identifierType", "purpose": "verify-account" }`.
   * Sends (or re-sends) the verification code for an unverified account.
   */
  verificationCodes: '/auth/verification-codes',

  /**
   * NEW. POST. Body: `{ "identifier", "identifierType", "purpose", "code" }`.
   * Checks a six-digit code.
   */
  verifyCode: '/auth/verification-codes/verify',
} as const;
