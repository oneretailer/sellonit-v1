/**
 * Frontend types for the Sellonit auth API.
 *
 * Shapes mirror the backend contract in docs/auth-registration-contract.md
 * and reuse the generated OpenAPI types from @sellonit/shared where they match.
 * `VerifyEmailResponse` and the login response wrapper are typed here directly
 * from the implementation — no fields are invented.
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

/** POST /api/v1/auth/register — request body (contract: `fullName`, `email`, `password`). */
export type RegisterUserRequest = {
  /** Full name as typed (2-80 chars). The API derives firstName/lastName from it. */
  fullName: string;
  /** Normalised (trimmed, lowercased) before sending. */
  email: string;
  /** Sent exactly as typed — never trimmed. */
  password: string;
};

/** POST /api/v1/auth/register — 201 response. */
export type RegisterUserResponse = {
  data: AuthUser;
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

/** POST /api/v1/auth/resend-verification — request body. */
export type ResendVerificationRequest = {
  /** Normalised (trimmed, lowercased) before sending. */
  email: string;
};

/** POST /api/v1/auth/resend-verification — 202 response (sent regardless of account existence). */
export type ResendVerificationResponse = {
  data: {
    sent: boolean;
  };
};

/** POST /api/v1/auth/verify-email — request body. `token` is the 64-character hex token from the email link. */
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

/** PATCH /auth/me — request body. The API normalises the phone number. */
export type UpdatePhoneRequest = {
  phone: string;
};
