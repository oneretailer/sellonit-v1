import { describe, expect, it } from 'vitest';
import { ApiError } from '../api-client';
import { authErrorMessage } from './errors';

describe('real auth error mapping', () => {
  it.each(['incorrect', 'expired', 'consumed'])(
    'maps %s verification failures without inventing a distinct backend state',
    () => {
      expect(
        authErrorMessage(
          new ApiError(
            400,
            'INVALID_VERIFICATION_TOKEN',
            'Verification token is invalid or expired',
          ),
        ),
      ).toBe(
        'That verification code or link is invalid, expired, or already used. Check it and try again.',
      );
    },
  );
  it('maps duplicate email', () => {
    expect(
      authErrorMessage(
        new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists'),
      ),
    ).toContain('You can log in instead');
  });
  it('maps the email login prerequisite', () => {
    expect(
      authErrorMessage(
        new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in'),
      ),
    ).toContain('verification link');
  });
});
