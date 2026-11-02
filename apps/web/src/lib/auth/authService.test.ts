import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from './authEndpoints';
import {
  AUTH_MESSAGES,
  EmailRequiredError,
  ResendUnavailableError,
  VerificationLinkRequiredError,
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

const emailIdentifier = { identifier: 'jane@example.com', identifierType: 'email' as const };
const phoneIdentifier = { identifier: '08012345678', identifierType: 'phone' as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('endpoint paths match the backend router', () => {
  it('lists exactly the auth routes the API mounts under /api/v1/auth', () => {
    expect(AUTH_ENDPOINTS).toEqual({
      register: '/auth/register',
      login: '/auth/login',
      me: '/auth/me',
      verifyEmail: '/auth/verify-email',
      verifyEmailAndLogin: '/auth/verify-email-and-login',
      sendPhoneVerification: '/auth/send-phone-verification',
      verifyPhone: '/auth/verify-phone',
      forgotPassword: '/auth/forgot-password',
      verifyResetCode: '/auth/verification-codes/verify',
      resetPassword: '/auth/reset-password',
      businessIntent: '/auth/business-intent',
    });
  });
});

describe('login', () => {
  it('posts to /auth/login with the existing email field', async () => {
    const { calls } = stubFetch(200, { user: {}, expiresIn: 60 });
    await loginWithIdentifier({ ...emailIdentifier, password: 'secret' });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/login',
      method: 'POST',
      body: { email: 'jane@example.com', password: 'secret' },
    });
  });

  it('refuses a phone identifier locally, because the API validates email only', async () => {
    const { calls } = stubFetch(200, {});
    const error: unknown = await loginWithIdentifier({
      ...phoneIdentifier,
      password: 'secret',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailRequiredError);
    expect(mapLoginError(error)).toBe('email-required');
    expect(calls).toHaveLength(0);
  });
});

describe('forgot password (request → verify → reset)', () => {
  it('sends the reset code to POST /auth/forgot-password', async () => {
    const { calls } = stubFetch(202, { data: { sent: true } });
    await sendResetCode(emailIdentifier);
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/forgot-password',
      method: 'POST',
      body: { email: 'jane@example.com' },
    });
  });

  it('re-sends the reset code through the same endpoint', async () => {
    const { calls } = stubFetch(202, { data: { sent: true } });
    await resendCode({ ...emailIdentifier, purpose: 'reset-password' });
    expect(calls[0]?.url).toBe('/api/v1/auth/forgot-password');
    expect(calls[0]?.body).toEqual({ email: 'jane@example.com' });
  });

  it('does not request a reset code for a phone number', async () => {
    const { calls } = stubFetch(202, {});
    const error: unknown = await sendResetCode(phoneIdentifier).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailRequiredError);
    expect(mapSendCodeError(error)).toBe('email-required');
    expect(calls).toHaveLength(0);
  });

  it('verifies the code with POST /auth/verification-codes/verify and no reset token', async () => {
    const { calls } = stubFetch(200, { data: { verified: true } });
    const result = await verifyCode({
      ...emailIdentifier,
      purpose: 'reset-password',
      code: '123456',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/verification-codes/verify',
      method: 'POST',
      body: { identifier: 'jane@example.com', code: '123456' },
    });
    expect(result).toBeUndefined();
  });

  it('sets the new password with POST /auth/reset-password using email, code and password', async () => {
    const { calls } = stubFetch(200, { data: { message: 'Password reset successfully' } });
    await resetPassword({
      identifier: 'jane@example.com',
      code: '123456',
      password: ' passw0rd ',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/reset-password',
      method: 'POST',
      body: { email: 'jane@example.com', code: '123456', password: ' passw0rd ' },
    });
  });
});

describe('flows with no backend route', () => {
  it('does not call an unconfirmed account-verification resend route', async () => {
    const { calls } = stubFetch(200, {});
    const error: unknown = await resendCode({
      ...emailIdentifier,
      purpose: 'verify-account',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ResendUnavailableError);
    expect(mapResendCodeError(error)).toBe('resend-unavailable');
    expect(authMessageFor('resend-unavailable')).toBe(AUTH_MESSAGES.resendUnavailable);
    expect(calls).toHaveLength(0);
  });

  it('does not verify an account with a code, because verification is link-based', async () => {
    const { calls } = stubFetch(200, {});
    const error: unknown = await verifyCode({
      ...emailIdentifier,
      purpose: 'verify-account',
      code: '123456',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VerificationLinkRequiredError);
    expect(mapVerifyCodeError(error)).toBe('verification-link-required');
    expect(calls).toHaveLength(0);
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

  it('login and forgot password: ACCOUNT_UNAVAILABLE is account-unavailable', () => {
    expect(mapLoginError(new ApiError(403, 'ACCOUNT_UNAVAILABLE', 'x'))).toBe(
      'account-unavailable',
    );
    expect(mapSendCodeError(new ApiError(403, 'ACCOUNT_UNAVAILABLE', 'x'))).toBe(
      'account-unavailable',
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
    expect(mapVerifyCodeError(new Error('The reset flow is unavailable'))).toBe('failed');
  });

  it('send: USER_NOT_FOUND is account-not-found; other API errors are send-failed', () => {
    expect(mapSendCodeError(new ApiError(404, 'USER_NOT_FOUND', 'x'))).toBe('account-not-found');
    expect(mapSendCodeError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe('send-failed');
    expect(mapSendCodeError(new ApiError(502, 'EMAIL_DELIVERY_FAILED', 'x'))).toBe('send-failed');
    expect(mapSendCodeError(new ApiError(503, 'DATABASE_MIGRATION_REQUIRED', 'x'))).toBe(
      'send-failed',
    );
    expect(mapResendCodeError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe('send-failed');
  });

  it('verify: INVALID_CODE (or a bare 400) is wrong-code', () => {
    expect(mapVerifyCodeError(new ApiError(400, 'INVALID_CODE', 'x'))).toBe('wrong-code');
    expect(mapVerifyCodeError(new ApiError(400, null, 'x'))).toBe('wrong-code');
  });

  it('reset: an invalid or expired code means the user must request a new one', () => {
    expect(mapResetPasswordError(new ApiError(400, 'INVALID_CODE', 'x'))).toBe('token-expired');
    expect(mapResetPasswordError(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe('failed');
  });

  it('every outcome has a user-facing message, and failures use the generic copy', () => {
    expect(authMessageFor('failed')).toBe('Something went wrong, please try again');
    expect(authMessageFor('wrong-credentials')).toBe('Wrong password, please try again');
    expect(authMessageFor('account-not-found')).toBe('Account not found');
    expect(authMessageFor('wrong-code')).toBe('Wrong code');
    expect(authMessageFor('send-failed')).toBe("We couldn't send the code, please try again");
    expect(authMessageFor('token-expired')).toBe(AUTH_MESSAGES.tokenExpired);
    expect(authMessageFor('account-unavailable')).toBe(AUTH_MESSAGES.accountUnavailable);
    expect(authMessageFor('email-required')).toBe(AUTH_MESSAGES.emailOnly);
    expect(authMessageFor('verification-link-required')).toBe(
      AUTH_MESSAGES.verificationLinkRequired,
    );
  });
});

describe('a failed request reaches the UI as a rejected promise (never a hang)', () => {
  it('network failure rejects login', async () => {
    stubNetworkDown();
    await expect(loginWithIdentifier({ ...emailIdentifier, password: 'x' })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('an unknown route rejects with an ApiError the mapper treats as failed', async () => {
    stubFetch(404, null);
    const error: unknown = await verifyCode({
      ...emailIdentifier,
      purpose: 'reset-password',
      code: '123456',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(mapVerifyCodeError(error)).toBe('failed');
  });
});
