/**
 * Frontend types for the Sellonit auth API.
 *
 * Shapes mirror the *implemented* backend contract (apps/api, read-only) and
 * reuse the generated OpenAPI types from @sellonit/shared where they match.
 * A few operations are not yet in docs/openapi.yaml (verify-phone and the
 * register/login response wrappers), so they are typed here directly from the
 * implementation — no fields are invented.
 */
import type { components } from '@sellonit/shared';

/** Public user shape as returned by the API (see `publicUserSelect` in the backend). */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: components['schemas']['UserStatus'];
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** POST /auth/register — request body (matches `RegisterRequest`). */
export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

/** POST /auth/register — 201 response. */
export type RegisterResponse = {
  data: AuthUser;
  /** Present in development/test builds only; used to verify the email. */
  emailVerificationToken?: string;
};

/** POST /auth/login — request body (matches `LoginRequest`). */
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

/** POST /auth/verify-phone — request body. `token` is the 6-digit SMS code. */
export type VerifyPhoneRequest = {
  token: string;
};

/** POST /auth/verify-phone — 200 response. */
export type VerifyPhoneResponse = {
  data: {
    verified: boolean;
  };
};

/** POST /auth/verify-email — request body. `token` is the 64-character hex token from the email link. */
export type VerifyEmailRequest = {
  token: string;
};

/** POST /auth/verify-email — 200 response. */
export type VerifyEmailResponse = {
  data: {
    verified: boolean;
  };
};

/** GET /auth/me — 200 response. */
export type MeResponse = {
  data: AuthUser;
};

/** PATCH /auth/me — adds or replaces the phone number on an existing account. */
export type UpdatePhoneRequest = {
  phone: string;
};
