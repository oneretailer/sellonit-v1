/**
 * Typed client for the auth endpoints the web app uses.
 *
 * Every call goes through `apiFetch`, which uses same-origin `/api/v1/*`. The
 * Next.js proxy forwards it to the API, so the browser never calls port 4000.
 *
 * Not called here: GET /auth/verify-email/:token (the link page uses POST), and
 * the endpoints listed as missing in the integration report. They are not stubbed.
 */
import { apiFetch } from '@/lib/api-client';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
} from './types';

/** Creates the account. Sends the SMS code when `phone` is given. Sends the email link. */
export function register(input: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** `code` is the 6-digit SMS code. Sent as `token` in the body, as the API expects. */
export function verifyPhone(code: string): Promise<VerifyPhoneResponse> {
  const body: VerifyPhoneRequest = { token: code };
  return apiFetch<VerifyPhoneResponse>('/auth/verify-phone', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** `token` is the token from the `/verify-email?token=` link. */
export function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const body: VerifyEmailRequest = { token };
  return apiFetch<VerifyEmailResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', { method: 'GET' });
}
