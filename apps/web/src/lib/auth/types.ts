/**
 * Frontend types for the Sellonit auth API.
 *
 * Shapes reuse the generated OpenAPI schemas from `@sellonit/shared` where
 * aligned, and mirror the live backend (`apps/api/src/modules/auth/*`) where
 * `docs/openapi.yaml` has documented drift (see `BE-007` in
 * `docs/backend-handoff.md`).
 */
import type { components } from '@sellonit/shared';

type Schemas = components['schemas'];

/** Onboarding business type stored on the user by PUT /auth/business-intent. */
export type BusinessType = Schemas['BusinessType'];

/**
 * Public user shape returned by `publicUserSelect` (`auth.service.ts`).
 * Reuses `Schemas['User']` from `@sellonit/shared`, keeping `onboardingIntent`
 * nullable (`openapi-typescript` omits `| null` when `type: [string, 'null']`
 * is combined with `$ref`).
 */
export type AuthUser = Omit<Schemas['User'], 'onboardingIntent'> & {
  /** Saved onboarding role (from PUT /auth/business-intent), null until chosen. */
  onboardingIntent: BusinessType | null;
};

/**
 * POST /api/v1/auth/register — UI input shape.
 * `registerUser` derives `{ firstName, lastName }` matching `Schemas['RegisterRequest']`.
 */
export type RegisterUserRequest = {
  /** Full name as typed (2-80 chars). The client derives firstName/lastName from it. */
  fullName: string;
  /** Trimmed and lowercased before sending. The backend accepts email only. */
  email: Schemas['RegisterRequest']['email'];
  /** Sent exactly as typed — never trimmed. */
  password: Schemas['RegisterRequest']['password'];
};

/** POST /api/v1/auth/register — 201 response (`RegisterResponse` in `@sellonit/shared`). */
export type RegisterUserResponse = Omit<Schemas['RegisterResponse'], 'data'> & {
  data: AuthUser;
};

/** POST /api/v1/auth/login — request body from `@sellonit/shared`. */
export type LoginRequest = Schemas['LoginRequest'];

/** POST /auth/login — 200 response (`AuthResponse` in `@sellonit/shared`). */
export type LoginResponse = Omit<Schemas['AuthResponse'], 'user'> & {
  user: AuthUser;
};

/**
 * POST /auth/resend-verification — request body (`TODO(BE-008)`: unimplemented).
 */
export type ResendVerificationRequest = Pick<Schemas['ForgotPasswordRequest'], 'email'>;

/** Response shape the resend endpoint will return once `BE-008` is implemented. */
export type ResendVerificationResponse = {
  data: {
    sent: boolean;
  };
};

/** POST /api/v1/auth/verify-email-and-login — request body from `@sellonit/shared`. */
export type VerifyEmailRequest = Schemas['VerifyEmailRequest'];

/** POST /auth/verify-email-and-login — 200 response (sets the session cookie). */
export type VerifyEmailResponse = LoginResponse;

/** GET /auth/me — 200 response. */
export type MeResponse = {
  data: AuthUser;
};

/** PATCH /auth/me — request body from `@sellonit/shared`. */
export type UpdatePhoneRequest = Schemas['UpdatePhoneRequest'];

/** POST /auth/forgot-password — request body from `@sellonit/shared`. */
export type ForgotPasswordRequest = Schemas['ForgotPasswordRequest'];

/** POST /auth/forgot-password — 202 response. */
export type ForgotPasswordResponse = {
  data: { sent: boolean };
};

/**
 * POST /auth/verification-codes/verify — request body.
 * Narrowed explicitly because OpenAPI `anyOf` generates `{ ... } | unknown` in `api.d.ts`.
 */
export type VerifyPasswordResetCodeRequest =
  { identifier: string; code: string } | { email: string; code: string };

/** POST /auth/verification-codes/verify — 200 response (`VerificationStatusResponse`). */
export type VerifyPasswordResetCodeResponse = Schemas['VerificationStatusResponse'];

/** POST /auth/reset-password — request body from `@sellonit/shared`. */
export type ResetPasswordRequest = Schemas['ResetPasswordRequest'];

/** POST /auth/reset-password — 200 response. */
export type ResetPasswordResponse = {
  data: { message: string };
};

/** POST /auth/send-phone-verification — request body. */
export type SendPhoneVerificationRequest = Pick<Schemas['ForgotPasswordRequest'], 'email'>;

/** POST /auth/send-phone-verification — 200 response. */
export type SendPhoneVerificationResponse = {
  data: { sent: boolean };
};

/** POST /auth/verify-phone — request body (`token` is the 6-digit SMS code). */
export type VerifyPhoneRequest = Schemas['VerifyEmailRequest'];

/** POST /auth/verify-phone — 200 response (`VerificationStatusResponse`). */
export type VerifyPhoneResponse = Schemas['VerificationStatusResponse'];
