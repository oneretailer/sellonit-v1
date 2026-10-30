/**
 * Typed client for the auth endpoints the web app uses.
 *
 * Every call goes through `apiFetch`, which uses same-origin `/api/v1/*`. The
 * Next.js proxy forwards it to the API (see `rewrites` in next.config.ts, fed
 * by API_INTERNAL_URL), so the browser never calls the API host directly and
 * no API URL or key reaches the client. Session cookies are managed by the
 * browser; this module never reads or writes them.
 *
 * Contract: docs/auth-registration-contract.md. `registerUser` also sends the
 * derived `firstName`/`lastName` pair so the pre-contract backend (which only
 * understands those fields) keeps working; the contract backend may ignore it.
 */
import { apiFetch, ApiError, NetworkError } from '@/lib/api-client';
import { normalizeIdentifier } from './identifier';
import { FORM_ERRORS, splitFullName, type RegisterFormValues } from '@/lib/validation/auth';
import type {
  MeResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  UpdatePhoneRequest,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from './types';

/** FOR REMOVAL — dev mock switch (NEXT_PUBLIC_MOCK_AUTH=true). Default OFF. */
const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

async function registerUserRequest(input: RegisterUserRequest): Promise<RegisterUserResponse> {
  const fullName = input.fullName.trim();
  const { firstName, lastName } = splitFullName(fullName);
  return apiFetch<RegisterUserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      // Contract body.
      fullName,
      email: normalizeIdentifier(input.email).identifier,
      password: input.password, // never trimmed
      // Legacy compatibility fields for the pre-contract backend; safe to ignore.
      firstName,
      lastName,
    }),
  });
}

/**
 * Creates the account and triggers the verification email. The password is
 * sent exactly as typed and never logged. The response body is not relied on
 * for anything beyond success.
 */
export async function registerUser(input: RegisterUserRequest): Promise<RegisterUserResponse> {
  if (MOCK_AUTH) {
    const { mockRegisterUser } = await import('./auth.mock');
    return mockRegisterUser(input);
  }
  return registerUserRequest(input);
}

function resendVerificationRequest(
  input: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  // The inspected backend routes do not expose email-verification resend. Avoid calling an unconfirmed route.
  void input;
  return Promise.reject(
    new Error('Verification email resend is not supported by the current API.'),
  );
}

/**
 * Asks for a new verification email. The API answers 202 even when the email
 * has no account (no account enumeration), and 429 when rate limited.
 */
export async function resendVerification(
  input: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  if (MOCK_AUTH) {
    const { mockResendVerification } = await import('./auth.mock');
    return mockResendVerification(input);
  }
  return resendVerificationRequest(input);
}

async function verifyEmailRequest(token: string): Promise<VerifyEmailResponse> {
  const body: VerifyEmailRequest = { token };
  // Backend route that verifies and establishes the session cookie.
  return apiFetch<VerifyEmailResponse>('/auth/verify-email-and-login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * `token` is the token from the `/auth/verify-email/confirm?token=` link.
 * On success the contract API also establishes the session cookie, so the
 * app can show the standalone success screen before the onboarding gate.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  if (MOCK_AUTH) {
    const { mockVerifyEmail } = await import('./auth.mock');
    return mockVerifyEmail(token);
  }
  return verifyEmailRequest(token);
}

/** PATCH /auth/me — sets the account phone number (`{ phone }`). Requires the session cookie. */
export function updatePhone(phone: string): Promise<MeResponse> {
  const body: UpdatePhoneRequest = { phone };
  return apiFetch<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', { method: 'GET' });
}

/* ── Register error mapping ────────────────────────────────────────────── */

export type RegisterErrorState = {
  fields: Partial<Record<'fullName' | 'email' | 'password', string>>;
  form: string | null;
};

/**
 * Normalises any register failure into per-field and form-level messages:
 * 409 → email field, 422 → the server's field messages, 429 → rate limit,
 * network/5xx → form-level. Unknown shapes fall back to minimal copy.
 */
export function mapRegisterError(error: unknown): RegisterErrorState {
  if (error instanceof NetworkError) {
    return { fields: {}, form: FORM_ERRORS.generic };
  }
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'EMAIL_ALREADY_EXISTS') {
      return { fields: { email: FORM_ERRORS.emailTaken }, form: null };
    }
    if (error.status === 429) {
      return { fields: {}, form: FORM_ERRORS.rateLimited };
    }
    if (error.fields) {
      const fields: RegisterErrorState['fields'] = {};
      for (const key of ['fullName', 'email', 'password'] as const) {
        const message = error.fields[key];
        if (typeof message === 'string' && message.length > 0) {
          fields[key] = message;
        }
      }
      return { fields, form: Object.keys(fields).length > 0 ? null : FORM_ERRORS.validation };
    }
    if (error.status >= 500) {
      return { fields: {}, form: FORM_ERRORS.generic };
    }
    return { fields: {}, form: FORM_ERRORS.validation };
  }
  return { fields: {}, form: FORM_ERRORS.generic };
}

/** Form values → the request payload the API layer expects. */
export function toRegisterUserRequest(values: RegisterFormValues): RegisterUserRequest {
  return { fullName: values.fullName, email: values.email, password: values.password };
}
