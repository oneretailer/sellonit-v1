import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { authErrorMessage } from './errors';
import { formatPhoneDisplay, isEmail } from './validation';

describe('isEmail', () => {
  it('accepts plain email addresses', () => {
    expect(isEmail('ada@example.com')).toBe(true);
    expect(isEmail('  ada@example.com  ')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isEmail('')).toBe(false);
    expect(isEmail('ada')).toBe(false);
    expect(isEmail('ada@example')).toBe(false);
    expect(isEmail('ada @example.com')).toBe(false);
  });
});

describe('formatPhoneDisplay', () => {
  it('formats the local form', () => {
    expect(formatPhoneDisplay('08031234567')).toBe('+234 803 123 4567');
  });

  it('formats the international form', () => {
    expect(formatPhoneDisplay('+2348031234567')).toBe('+234 803 123 4567');
    expect(formatPhoneDisplay('2348031234567')).toBe('+234 803 123 4567');
  });

  it('returns unrecognised values unchanged', () => {
    expect(formatPhoneDisplay('not-a-number')).toBe('not-a-number');
  });
});

describe('authErrorMessage', () => {
  it('maps known backend codes to user-facing messages', () => {
    expect(
      authErrorMessage(
        new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists'),
      ),
    ).toBe('An account with this email already exists. You can log in instead.');
    expect(authErrorMessage(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'That verification code or link is invalid or has expired.',
    );
    expect(authErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(
      'Email or password is incorrect.',
    );
    expect(authErrorMessage(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'x'))).toContain(
      'Verify your email before logging in',
    );
  });

  it('falls back to the backend message for unknown codes', () => {
    expect(authErrorMessage(new ApiError(400, 'SOME_FUTURE_CODE', 'Future message'))).toBe(
      'Future message',
    );
  });

  it('uses a network message for unreachable APIs', () => {
    expect(authErrorMessage(new NetworkError())).toBe(
      'We could not reach Sellonit. Check your connection and try again.',
    );
  });

  it('never surfaces unknown thrown values', () => {
    expect(authErrorMessage(new Error('internal detail'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(authErrorMessage('boom')).toBe('Something went wrong. Please try again.');
  });
});
