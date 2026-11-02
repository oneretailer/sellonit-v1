/**
 * Frontend types for the Sellonit auth API.
 *
 * Shapes mirror the live backend (`apps/api/src/modules/auth/*` and
 * `apps/api/src/http/routes/auth.routes.ts`) and reuse the generated OpenAPI
 * types from @sellonit/shared where they match. No fields are invented.
 */
import type { components } from '@sellonit/shared';

/** Onboarding business type stored on the user by PUT /auth/business-intent. */
export type BusinessType = components['schemas']['BusinessType'];

/** Public user shape as returned by the API (see `publicUserSelect` in the backend). */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: components['schemas']['UserStatus'];
  /** Saved onboarding role (from PUT /auth/business-intent), null until chosen. */
  onboardingIntent: BusinessType | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * POST /api/v1/auth/register — request body.
 *
 * The contract (docs/auth-registration-contract.md) asks for `fullName`; the
 * live backend reads `firstName`/`lastName`. The client sends both so either
 * implementation works.
 */
export type RegisterUserRequest = {
  /** Full name as typed (2-80 chars). The API derives firstName/lastName from it. */
  fullName: string;
  /** Trimmed and lowercased before sending. The backend accepts email only. */
  email: string;
  /** Sent exactly as typed — never trimmed. */
  password: string;
};

/** POST /api/v1/auth/register — 201 response. */
export type RegisterUserResponse = {
  data: AuthUser;
  /** Development/test only (the backend never returns it in production). */
  emailVerificationToken?: string;
};

/** POST /api/v1/auth/login — request body (matches `LoginRequest`). */
export type LoginRequest = {
  email: string;
  password: string;
};

/** POST /auth/login — 200 response. The session cookie is set by the API. */
export type LoginResponse = {
  user: AuthUser;
  /** Session lifetime in seconds. */
  expiresIn: number;
};

/**
 * POST /auth/resend-verification — request body.
 * The endpoint is specified in docs/auth-registration-contract.md §4 but is not
 * implemented by the backend, so the app never sends it.
 */
export type ResendVerificationRequest = {
  email: string;
};

/** Response shape the resend endpoint will return once it exists. */
export type ResendVerificationResponse = {
  data: {
    sent: boolean;
  };
};

/**
 * POST /api/v1/auth/verify-email-and-login — request body. `token` is the
 * 64-character hex token from the `/auth/verify-email/confirm?token=` link.
 */
export type VerifyEmailRequest = {
  token: string;
};

/** POST /auth/verify-email-and-login — 200 response (sets the session cookie). */
export type VerifyEmailResponse = {
  user: AuthUser;
  expiresIn: number;
};

/** GET /auth/me — 200 response. */
export type MeResponse = {
  data: AuthUser;
};

/** PATCH /auth/me — request body. The API normalises the phone number. */
export type UpdatePhoneRequest = {
  phone: string;
};

/** POST /auth/forgot-password — request body. The backend accepts email only. */
export type ForgotPasswordRequest = {
  email: string;
};

/** POST /auth/forgot-password — 202 response. The body is not relied on. */
export type ForgotPasswordResponse = {
  data: { sent: boolean };
};

/** POST /auth/verification-codes/verify — request body (`identifier` is an email). */
export type VerifyPasswordResetCodeRequest = {
  identifier: string;
  code: string;
};

/** POST /auth/verification-codes/verify — 200 response. It carries no reset token. */
export type VerifyPasswordResetCodeResponse = {
  data: { verified: boolean };
};

/** POST /auth/reset-password — request body. The code is re-checked server-side. */
export type ResetPasswordRequest = {
  email: string;
  code: string;
  password: string;
};

/** POST /auth/reset-password — 200 response. */
export type ResetPasswordResponse = {
  data: { message: string };
};

/** POST /auth/send-phone-verification — request body. */
export type SendPhoneVerificationRequest = {
  email: string;
};

/** POST /auth/send-phone-verification — 200 response. */
export type SendPhoneVerificationResponse = {
  data: { sent: boolean };
};

/** POST /auth/verify-phone — request body. `token` is the 6-digit SMS code. */
export type VerifyPhoneRequest = {
  token: string;
};

/** POST /auth/verify-phone — 200 response. */
export type VerifyPhoneResponse = {
  data: { verified: boolean };
};
