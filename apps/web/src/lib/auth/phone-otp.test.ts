import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { mapToPhoneOtpErrorKind, PhoneOtpError } from './phone-otp';
import { mockPhoneOtpService } from './phone-otp.mock';

describe('mapToPhoneOtpErrorKind', () => {
  it('maps real API codes to the verification error states', () => {
    expect(mapToPhoneOtpErrorKind(new ApiError(400, 'INVALID_PHONE', 'x'))).toBe('invalid_phone');
    expect(mapToPhoneOtpErrorKind(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe(
      'invalid_phone',
    );
    expect(mapToPhoneOtpErrorKind(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'incorrect_code',
    );
  });

  it('maps proposed codes and HTTP 429 to the attempt-limit state', () => {
    expect(mapToPhoneOtpErrorKind(new ApiError(429, null, 'x'))).toBe('too_many_attempts');
    expect(mapToPhoneOtpErrorKind(new ApiError(400, 'TOO_MANY_ATTEMPTS', 'x'))).toBe(
      'too_many_attempts',
    );
  });

  it('maps network failures and gateway errors to the network state', () => {
    expect(mapToPhoneOtpErrorKind(new NetworkError())).toBe('network');
    expect(mapToPhoneOtpErrorKind(new ApiError(503, null, 'x'))).toBe('network');
  });

  it('falls back to unknown without exposing server messages', () => {
    expect(mapToPhoneOtpErrorKind(new ApiError(500, 'SOMETHING', 'internal detail'))).toBe(
      'unknown',
    );
    expect(mapToPhoneOtpErrorKind(new Error('boom'))).toBe('unknown');
  });
});

describe('mockPhoneOtpService (dev fixtures)', () => {
  it('rejects fixture numbers with the matching error kind', async () => {
    await expect(mockPhoneOtpService.sendCode('08000000000')).rejects.toMatchObject({
      kind: 'phone_exists',
    });
    await expect(mockPhoneOtpService.sendCode('08031111111')).rejects.toMatchObject({
      kind: 'unsupported_phone',
    });
  });

  it('accepts the code 123456 and blocks after three wrong codes', async () => {
    const phone = '08055555555';
    await mockPhoneOtpService.sendCode(phone);
    await expect(mockPhoneOtpService.verifyCode(phone, '000000')).rejects.toBeInstanceOf(
      PhoneOtpError,
    );
    await expect(mockPhoneOtpService.verifyCode(phone, '000000')).rejects.toMatchObject({
      kind: 'incorrect_code',
    });
    await expect(mockPhoneOtpService.verifyCode(phone, '000000')).rejects.toMatchObject({
      kind: 'too_many_attempts',
    });
    await expect(mockPhoneOtpService.verifyCode(phone, '123456')).rejects.toMatchObject({
      kind: 'too_many_attempts',
    });
    await mockPhoneOtpService.resendCode(phone);
    await expect(mockPhoneOtpService.verifyCode(phone, '123456')).resolves.toBeUndefined();
  }, 10_000);
});
