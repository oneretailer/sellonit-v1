/**
 * Phone verification helper, kept for reference and DISABLED.
 *
 * The registration flow now calls POST /auth/verify-phone directly (see
 * lib/auth/api.ts). The UI does not import `phoneOtp`.
 *
 * `phoneOtp` is `unavailableService` in every build. The dev mock
 * (./phone-otp.mock.ts) is no longer selected, not even in development. To
 * re-enable it, change `PHONE_OTP_MOCK_ENABLED` below. The mock file is kept
 * and not deleted.
 */
import { ApiError, NetworkError } from '@/lib/api-client';
import { mockPhoneOtpService } from './phone-otp.mock';
import { PhoneOtpError, type PhoneOtpErrorKind, type PhoneOtpService } from './phone-otp.types';

export { PHONE_OTP_MESSAGES, PhoneOtpError } from './phone-otp.types';
export type { PhoneOtpErrorKind, PhoneOtpService } from './phone-otp.types';

/** DISABLED. Set to true only to use the dev mock again. */
const PHONE_OTP_MOCK_ENABLED = false;

/**
 * Maps a failure from the API client to a UI error kind.
 *
 * Codes marked "proposed" are not emitted by the current API. They are the
 * names this mapping expects once the endpoints exist, and must be agreed
 * with the backend before they are relied on.
 */
export function mapToPhoneOtpErrorKind(error: unknown): PhoneOtpErrorKind {
  if (error instanceof PhoneOtpError) {
    return error.kind;
  }
  if (error instanceof NetworkError) {
    return 'network';
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_PHONE':
      case 'VALIDATION_ERROR':
        return 'invalid_phone';
      case 'INVALID_VERIFICATION_TOKEN':
        return 'incorrect_code';
      case 'UNSUPPORTED_PHONE': // proposed
        return 'unsupported_phone';
      case 'PHONE_ALREADY_REGISTERED': // proposed
        return 'phone_exists';
      case 'TOO_MANY_ATTEMPTS': // proposed
        return 'too_many_attempts';
      case null:
      default:
        break;
    }
    if (error.status === 429) {
      return 'too_many_attempts';
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return 'network';
    }
  }
  return 'unknown';
}

/** Converts any thrown value into a {@link PhoneOtpError}. */
export function toPhoneOtpError(error: unknown): PhoneOtpError {
  return error instanceof PhoneOtpError ? error : new PhoneOtpError(mapToPhoneOtpErrorKind(error));
}

const unavailableService: PhoneOtpService = {
  sendCode: () => Promise.reject(new PhoneOtpError('unavailable')),
  resendCode: () => Promise.reject(new PhoneOtpError('unavailable')),
  verifyCode: () => Promise.reject(new PhoneOtpError('unavailable')),
};

/** Not used by the UI. Disabled, so it always reports `unavailable`. */
export const phoneOtp: PhoneOtpService = PHONE_OTP_MOCK_ENABLED
  ? mockPhoneOtpService
  : unavailableService;
