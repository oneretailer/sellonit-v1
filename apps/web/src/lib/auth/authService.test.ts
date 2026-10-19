import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from './authEndpoints';
import {
  authMessageFor,
  loginWithIdentifier,
  mapLoginError,
  mapResendCodeError,
  mapResetPasswordError,
  mapSendCodeError,
  mapVerifyCodeError,
  resendCode,
  resetPassword,
  sendResetCode,
  verifyCode,
} from './authService';

type Captured = { url: string; method: string; body: unknown };

/** Stubs fetch with a JSON response (or an empty one) and records the request. */
function stubFetch(status: number, body: unknown = null): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
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

/** Stubs fetch with a network failure. */
function stubNetworkDown(): void {
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('confirmed endpoint behavior', () => {
  it('login posts to the confirmed route using the existing email field', async () => {
    const { calls } = stubFetch(200, { user: {}, expiresIn: 60 });
    await loginWithIdentifier({
      identifier: 'jane@example.com',
      identifierType: 'email',
      password: 'secret',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/login',
      method: 'POST',
      body: { email: 'jane@example.com', password: 'secret' },
    });
  });

  it('does not call unsupported reset or verification-code routes', async () => {
    const { calls } = stubFetch(200, {});
    await expect(
      sendResetCode({ identifier: 'jane@example.com', identifierType: 'email' }),
    ).rejects.toThrow('not supported');
    await expect(
      resendCode({
        identifier: 'jane@example.com',
        identifierType: 'email',
        purpose: 'verify-account',
      }),
    ).rejects.toThrow('not supported');
    await expect(
      verifyCode({
        identifier: 'jane@example.com',
        identifierType: 'email',
        purpose: 'reset-password',
        code: '123456',
      }),
    ).rejects.toThrow('not supported');
    await expect(resetPassword({ resetToken: 'secret', password: 'secret' })).rejects.toThrow(
      'not supported',
    );
    expect(calls).toHaveLength(0);
  });

  it('only contains the confirmed login endpoint', () => {
    expect(AUTH_ENDPOINTS).toEqual({ login: '/auth/login' });
  });
});

describe('error mapping', () => {
  it('login: wrong credentials by code or by 401', () => {
    expect(mapLoginError(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe('wrong-credentials');
    expect(mapLoginError(new ApiError(401, null, 'x'))).toBe('wrong-credentials');
  });

  it('login: unverified account by either code', () => {
    expect(mapLoginError(new ApiError(403, 'ACCOUNT_NOT_VERIFIED', 'x'))).toBe(
      'account-not-verified',
    );
    expect(mapLoginError(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'x'))).toBe(
      'account-not-verified',
    );
  });

  it('network, server and missing-endpoint failures are generic', () => {
    expect(mapLoginError(new NetworkError())).toBe('failed');
    expect(mapLoginError(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBe('failed');
    expect(mapSendCodeError(new ApiError(404, null, 'Cannot POST'))).toBe('send-failed');
    expect(mapResendCodeError(new ApiError(503, null, 'x'))).toBe('send-failed');
    expect(mapVerifyCodeError(new NetworkError())).toBe('failed');
    expect(mapResetPasswordError(new ApiError(500, null, 'x'))).toBe('failed');
  });

  it('plain (non-API) errors are generic', () => {
    expect(mapLoginError(new Error('boom'))).toBe('failed');
    expect(mapVerifyCodeError(new Error('Reset token missing'))).toBe('failed');
  });

  it('send: USER_NOT_FOUND is account-not-found; other API errors are send-failed', () => {
    expect(mapSendCodeError(new ApiError(404, 'USER_NOT_FOUND', 'x'))).toBe('account-not-found');
    expect(mapSendCodeError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe('send-failed');
    expect(mapResendCodeError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe('send-failed');
  });

  it('verify: INVALID_CODE (or a bare 400) is wrong-code', () => {
    expect(mapVerifyCodeError(new ApiError(400, 'INVALID_CODE', 'x'))).toBe('wrong-code');
    expect(mapVerifyCodeError(new ApiError(400, null, 'x'))).toBe('wrong-code');
  });

  it('reset: expired or invalid token is token-expired', () => {
    expect(mapResetPasswordError(new ApiError(401, 'INVALID_RESET_TOKEN', 'x'))).toBe(
      'token-expired',
    );
    expect(mapResetPasswordError(new ApiError(400, 'RESET_TOKEN_EXPIRED', 'x'))).toBe(
      'token-expired',
    );
  });

  it('every outcome has a user-facing message, and failures use the generic copy', () => {
    expect(authMessageFor('failed')).toBe('Something went wrong, please try again');
    expect(authMessageFor('wrong-credentials')).toBe('Wrong password, please try again');
    expect(authMessageFor('account-not-found')).toBe('Account not found');
    expect(authMessageFor('wrong-code')).toBe('Wrong code');
    expect(authMessageFor('send-failed')).toBe("We couldn't send the code, please try again");
  });
});

describe('a failed request reaches the UI as a rejected promise (never a hang)', () => {
  it('network failure rejects login', async () => {
    stubNetworkDown();
    await expect(
      loginWithIdentifier({
        identifier: 'jane@example.com',
        identifierType: 'email',
        password: 'x',
      }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('a 404 from a not-yet-built endpoint rejects with an ApiError the mapper treats as failed', async () => {
    stubFetch(404, null);
    const error: unknown = await verifyCode({
      identifier: 'jane@example.com',
      identifierType: 'email',
      purpose: 'verify-account',
      code: '123456',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(mapVerifyCodeError(error)).toBe('failed');
  });
});
