/**
 * Frontend API calls for the authentication flows.
 *
 * Only operations that exist in the implemented backend are exposed:
 * register, login, verify-phone and me. The backend does not currently expose
 * a resend-code or logout endpoint — see the integration report.
 */
import { apiFetch } from '@/lib/api-client';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyPhoneResponse,
} from './types';

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

/** `code` is the 6-digit code sent by SMS when the account was created. */
export function verifyPhone(code: string): Promise<VerifyPhoneResponse> {
  return apiFetch<VerifyPhoneResponse>('/auth/verify-phone', {
    method: 'POST',
    body: JSON.stringify({ token: code }),
  });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', { method: 'GET' });
}

export function verifyEmail(token: string): Promise<VerifyPhoneResponse> {
  return apiFetch<VerifyPhoneResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
