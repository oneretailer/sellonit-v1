/**
 * Every auth endpoint path the web app calls, in one place.
 *
 * Paths are relative to the same-origin API base `/api/v1` (see api-client.ts)
 * and mirror `apps/api/src/http/routes/auth.routes.ts`, the source of truth for
 * this contract. To change a path, edit one line here.
 *
 * Not listed because the backend does not implement them:
 * - `POST /auth/resend-verification` (docs/auth-registration-contract.md §4)
 * - `POST /auth/logout`, `POST /auth/refresh` (documented in docs/openapi.yaml
 *   but not mounted in auth.routes.ts)
 */
export const AUTH_ENDPOINTS = {
  /** POST `{ email, password, firstName, lastName }` → 201 `{ data: user }`. */
  register: '/auth/register',
  /**
   * POST `{ email, password }` → 200 `{ user, expiresIn }`. Sets the
   * `sellonit_access_token` cookie. The field is `email` only: the backend
   * validates it as an email address and has no phone login.
   */
  login: '/auth/login',
  /** GET → 200 `{ data: user }`; PATCH `{ phone }` → 200 `{ data: user }`. */
  me: '/auth/me',
  /** POST `{ token }` → 200 `{ data: { verified } }`. Verifies without a session. */
  verifyEmail: '/auth/verify-email',
  /** POST `{ token }` → 200 `{ user, expiresIn }`. Verifies and sets the session cookie. */
  verifyEmailAndLogin: '/auth/verify-email-and-login',
  /** POST `{ email }` → 200 `{ data: { sent } }`. */
  sendPhoneVerification: '/auth/send-phone-verification',
  /** POST `{ token }` (6 digits) → 200 `{ data: { verified } }`. */
  verifyPhone: '/auth/verify-phone',
  /** POST `{ email }` → 202 `{ data: { sent } }`. Emails a 6-digit code. */
  forgotPassword: '/auth/forgot-password',
  /** POST `{ identifier, code }` → 200 `{ data: { verified } }`. No reset token is issued. */
  verifyResetCode: '/auth/verification-codes/verify',
  /** POST `{ email, code, password }` → 200 `{ data: { message } }`. */
  resetPassword: '/auth/reset-password',
  /** PUT `{ businessType }` (RETAILER | ENTREPRENEUR | ENTERPRISE) → 200 `{ data: user }`. */
  businessIntent: '/auth/business-intent',
} as const;
