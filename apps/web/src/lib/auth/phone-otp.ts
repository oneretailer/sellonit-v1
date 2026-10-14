/**
 * Phone verification for the registration flow.
 *
 * The UI talks to `phoneOtp` only. Two implementations sit behind it:
 *
 * - Production: `unavailableService`. The API has no endpoint yet for
 *   sending, resending or checking a phone code for a phone number that has
 *   not been registered (see the integration gaps in the handoff notes), so it
 *   reports `unavailable` instead of pretending to succeed.
 * - Development: `mockPhoneOtpService` (./phone-otp.mock.ts). It is a MOCK and
 *   exists only so the screens can be built and tested before the endpoints
 *   exist. It is never used in `next build` / `next start`.
 *
 * When the real endpoints land, add a service that calls them, map their
 * failures through `toPhoneOtpError`, and replace the selection below.
 */
import { ApiError, NetworkError } from '@/lib/api-client';
import { mockPhoneOtpService } from './phone-otp.mock';
import { PhoneOtpError, type PhoneOtpErrorKind, type PhoneOtpService } from './phone-otp.types';

export { PHONE_OTP_MESSAGES, PhoneOtpError } from './phone-otp.types';
export type { PhoneOtpErrorKind, PhoneOtpService } from './phone-otp.types';

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

/** The service the UI uses. Mock only outside production builds. */
export const phoneOtp: PhoneOtpService =
  process.env.NODE_ENV === 'production' ? unavailableService : mockPhoneOtpService;
