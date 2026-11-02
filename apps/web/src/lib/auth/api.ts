/**
 * Typed client for the account endpoints the web app uses (register, email
 * verification, phone verification, account details).
 *
 * Every call goes through `apiFetch`, which uses same-origin `/api/v1/*`. The
 * Next.js proxy forwards it to the API (see `rewrites` in next.config.ts, fed
 * by API_INTERNAL_URL), so the browser never calls the API host directly and
 * no API URL or key reaches the client. Session cookies are managed by the
 * browser; this module never reads or writes them.
 *
 * Contract: docs/auth-registration-contract.md plus the live backend router
 * (apps/api/src/http/routes/auth.routes.ts). `registerUser` sends `fullName`
 * for the contract and the derived `firstName`/`lastName` pair that the
 * deployed backend actually reads.
 */
import { apiFetch, ApiError, NetworkError } from '@/lib/api-client';
import {
  normalizeEmail,
  splitFullName,
  FORM_ERRORS,
  type RegisterFormValues,
} from '@/lib/validation/auth';
import { AUTH_ENDPOINTS } from './authEndpoints';
import type {
  MeResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  SendPhoneVerificationRequest,
  SendPhoneVerificationResponse,
  UpdatePhoneRequest,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
} from './types';

/** FOR REMOVAL — dev mock switch (NEXT_PUBLIC_MOCK_AUTH=true). Default OFF. */
const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

async function registerUserRequest(input: RegisterUserRequest): Promise<RegisterUserResponse> {
  const fullName = input.fullName.trim();
  const { firstName, lastName } = splitFullName(fullName);
  return apiFetch<RegisterUserResponse>(AUTH_ENDPOINTS.register, {
    method: 'POST',
    body: JSON.stringify({
      // Contract body (docs/auth-registration-contract.md §1).
      fullName,
      email: normalizeEmail(input.email),
      password: input.password, // never trimmed
      // What the deployed backend reads today: `firstName`/`lastName`.
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

/**
 * Asks for a new verification email.
 *
 * BACKEND GAP: docs/auth-registration-contract.md §4 specifies
 * `POST /auth/resend-verification` (202, rate limited), but the route is not
 * implemented. The app therefore makes no request and reports a clear,
 * non-enumerating message; it will be wired here once the endpoint exists.
 */
export function resendVerification(
  _input: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  return Promise.reject(
    new Error(
      'Resending verification emails is not supported by the current API (the resend endpoint is not implemented yet).',
    ),
  );
}

async function verifyEmailRequest(token: string): Promise<VerifyEmailResponse> {
  const body: VerifyEmailRequest = { token };
  // Backend route that verifies and establishes the session cookie. The
  // sibling POST /auth/verify-email verifies without creating a session.
  return apiFetch<VerifyEmailResponse>(AUTH_ENDPOINTS.verifyEmailAndLogin, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * `token` is the token from the `/auth/verify-email/confirm?token=` link.
 * On success the backend also establishes the session cookie, so the app can
 * show the standalone success screen before the onboarding gate.
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
  return apiFetch<MeResponse>(AUTH_ENDPOINTS.me, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>(AUTH_ENDPOINTS.me, { method: 'GET' });
}

/**
 * POST /auth/send-phone-verification — sends a 6-digit SMS code to the phone on
 * the account. The backend answers 400 PHONE_NOT_SET, 409 PHONE_ALREADY_VERIFIED,
 * 503 SMS_NOT_CONFIGURED, 403 TWILIO_TRIAL_RECIPIENT_NOT_VERIFIED or 502
 * SMS_DELIVERY_FAILED; those messages are safe to show as-is (see errors.ts).
 */
export async function sendPhoneVerification(email: string): Promise<void> {
  const body: SendPhoneVerificationRequest = { email: normalizeEmail(email) };
  await apiFetch<SendPhoneVerificationResponse>(AUTH_ENDPOINTS.sendPhoneVerification, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /auth/verify-phone — checks the 6-digit SMS code (`{ token }`). */
export async function verifyPhone(code: string): Promise<VerifyPhoneResponse> {
  const body: VerifyPhoneRequest = { token: code };
  return apiFetch<VerifyPhoneResponse>(AUTH_ENDPOINTS.verifyPhone, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
