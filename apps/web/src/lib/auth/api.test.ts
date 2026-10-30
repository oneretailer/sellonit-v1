import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { FORM_ERRORS } from '@/lib/validation/auth';
import { mapRegisterError, toRegisterUserRequest, verifyEmail } from './api';

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

describe('email verification callback endpoint', () => {
  it('posts the link token to the real session-establishing endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.com' }, expiresIn: 60 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await verifyEmail('token-value');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/auth/verify-email-and-login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'token-value' }) }),
    );
    fetchSpy.mockRestore();
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
