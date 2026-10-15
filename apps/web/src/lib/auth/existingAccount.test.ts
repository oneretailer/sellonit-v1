import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { loginEmailPath, registerFailureAction } from './existingAccount';

describe('registerFailureAction', () => {
  it('treats 409 EMAIL_ALREADY_EXISTS as an existing account', () => {
    expect(registerFailureAction(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'x'))).toEqual({
      kind: 'account-exists',
    });
  });

  it('treats other failures as ordinary errors', () => {
    expect(registerFailureAction(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toEqual({
      kind: 'other',
    });
    expect(registerFailureAction(new ApiError(400, 'INVALID_PHONE', 'x'))).toEqual({
      kind: 'other',
    });
    expect(registerFailureAction(new NetworkError())).toEqual({ kind: 'other' });
  });
});

describe('loginEmailPath', () => {
  it('carries only the email, encoded, in the query string', () => {
    expect(loginEmailPath('ada+1@example.com')).toBe(
      '/auth/login/email?email=ada%2B1%40example.com',
    );
  });
});
