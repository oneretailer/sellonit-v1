/**
 * Types and copy for phone verification. Kept free of runtime dependencies so
 * the service implementations (phone-otp.ts and phone-otp.mock.ts) can both
 * import it without a cycle.
 */

export type PhoneOtpErrorKind =
  | 'invalid_phone'
  | 'unsupported_phone'
  | 'phone_exists'
  | 'incorrect_code'
  | 'too_many_attempts'
  | 'network'
  | 'unavailable'
  | 'unknown';

/** Copy shown inline for each error state. */
export const PHONE_OTP_MESSAGES: Record<PhoneOtpErrorKind, string> = {
  invalid_phone: 'Enter a valid 10-digit Nigerian phone number.',
  unsupported_phone: 'This phone number is not supported. Check the number and try again.',
  phone_exists: 'An account already exists with this phone number.',
  incorrect_code: 'That code is not correct. Check the text message and try again.',
  too_many_attempts: 'Too many incorrect attempts. Wait a few minutes, then request a new code.',
  network: 'We could not reach Sellonit. Check your connection and try again.',
  unavailable: 'Phone verification is not available right now. Please try again later.',
  unknown: 'Something went wrong. Please try again.',
};

export class PhoneOtpError extends Error {
  readonly kind: PhoneOtpErrorKind;

  constructor(kind: PhoneOtpErrorKind) {
    super(PHONE_OTP_MESSAGES[kind]);
    this.name = 'PhoneOtpError';
    this.kind = kind;
  }
}

/**
 * Phone numbers are passed in the local `0XXXXXXXXXX` form the API accepts.
 * `code` is the 6-digit SMS code.
 */
export interface PhoneOtpService {
  sendCode(localPhone: string): Promise<void>;
  resendCode(localPhone: string): Promise<void>;
  verifyCode(localPhone: string, code: string): Promise<void>;
}
