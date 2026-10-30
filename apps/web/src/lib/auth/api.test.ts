import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { FORM_ERRORS } from '@/lib/validation/auth';
import {
  getMe,
  mapRegisterError,
  registerUser,
  resendVerification,
  sendPhoneVerification,
  toRegisterUserRequest,
  updatePhone,
  verifyEmail,
  verifyPhone,
} from './api';

type Captured = { url: string; method: string; body: unknown };

/** Stubs fetch with a JSON response and records the request. */
function stubFetch(status: number, body: unknown = null): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: String(init.method),
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    const json = body !== null;
    return Promise.resolve(
      new Response(json ? JSON.stringify(body) : null, {
        status,
        headers: json ? { 'content-type': 'application/json' } : {},
      }),
    );
  });
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mapRegisterError', () => {
  it('maps 409 to the email field', () => {
    expect(mapRegisterError(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'x'))).toEqual({
      fields: { email: FORM_ERRORS.emailTaken },
      form: null,
    });
  });

  it('maps 422 server field errors onto the fields', () => {
    const error = new ApiError(422, 'VALIDATION_ERROR', 'x', 'req-1', {
      email: 'That address is not allowed.',
    });
    expect(mapRegisterError(error)).toEqual({
      fields: { email: 'That address is not allowed.' },
      form: null,
    });
  });

  it('maps 429 to the rate-limit message', () => {
    expect(mapRegisterError(new ApiError(429, 'RATE_LIMITED', 'x'))).toEqual({
      fields: {},
      form: FORM_ERRORS.rateLimited,
    });
  });

  it('maps network and server failures to the form-level message', () => {
    expect(mapRegisterError(new NetworkError()).form).toBe(FORM_ERRORS.generic);
    expect(mapRegisterError(new ApiError(500, 'INTERNAL_ERROR', 'x')).form).toBe(
      FORM_ERRORS.generic,
    );
  });

  it('maps other validation failures to the generic validation message', () => {
    expect(mapRegisterError(new ApiError(400, 'VALIDATION_ERROR', 'x')).form).toBe(
      FORM_ERRORS.validation,
    );
    expect(mapRegisterError(new Error('boom')).form).toBe(FORM_ERRORS.generic);
  });
});

describe('registration request', () => {
  it('posts fullName for the contract plus the firstName/lastName the API reads', async () => {
    const { calls } = stubFetch(201, { data: { id: 'u1' } });
    await registerUser({
      fullName: '  Ada Example ',
      email: 'You@Example.com',
      password: ' passw0rd ',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/register',
      method: 'POST',
      body: {
        fullName: 'Ada Example',
        email: 'you@example.com',
        password: ' passw0rd ',
        firstName: 'Ada',
        lastName: 'Example',
      },
    });
  });
});

describe('email verification callback endpoint', () => {
  it('posts the link token to the real session-establishing endpoint', async () => {
    const { calls } = stubFetch(200, { user: { id: 'u1', email: 'a@b.com' }, expiresIn: 60 });
    await verifyEmail('token-value');
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/verify-email-and-login',
      method: 'POST',
      body: { token: 'token-value' },
    });
  });
});

describe('email verification resend', () => {
  it('makes no request while the backend has no resend route', async () => {
    const { calls } = stubFetch(202, { data: { sent: true } });
    await expect(resendVerification({ email: 'jane@example.com' })).rejects.toThrow(
      'not supported by the current API',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('account details and phone verification', () => {
  it('reads the signed-in account with GET /auth/me', async () => {
    const { calls } = stubFetch(200, { data: { id: 'u1' } });
    await getMe();
    expect(calls[0]).toEqual({ url: '/api/v1/auth/me', method: 'GET', body: undefined });
  });

  it('updates the phone number with PATCH /auth/me', async () => {
    const { calls } = stubFetch(200, { data: { id: 'u1' } });
    await updatePhone('08031234567');
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/me',
      method: 'PATCH',
      body: { phone: '08031234567' },
    });
  });

  it('requests an SMS code with POST /auth/send-phone-verification', async () => {
    const { calls } = stubFetch(200, { data: { sent: true } });
    await sendPhoneVerification(' Jane@Example.com ');
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/send-phone-verification',
      method: 'POST',
      body: { email: 'jane@example.com' },
    });
  });

  it('checks the SMS code with POST /auth/verify-phone', async () => {
    const { calls } = stubFetch(200, { data: { verified: true } });
    await expect(verifyPhone('123456')).resolves.toEqual({ data: { verified: true } });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/verify-phone',
      method: 'POST',
      body: { token: '123456' },
    });
  });
});

describe('toRegisterUserRequest', () => {
  it('passes the form values through without trimming the password', () => {
    expect(
      toRegisterUserRequest({
        fullName: ' Ada Example ',
        email: 'You@Example.com',
        password: ' passw0rd ',
        confirm: ' passw0rd ',
        termsAccepted: true,
      }),
    ).toEqual({
      fullName: ' Ada Example ',
      email: 'You@Example.com',
      password: ' passw0rd ',
    });
  });
});
