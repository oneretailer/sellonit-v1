/**
 * ⚠️ MOCK — DEVELOPMENT ONLY ⚠️ — DISABLED
 *
 * Stands in for phone-verification endpoints that do not exist in apps/api yet.
 * DISABLED: `phone-otp.ts` no longer selects it (`PHONE_OTP_MOCK_ENABLED = false`).
 * The registration flow uses the real POST /auth/verify-phone. Kept, not deleted.
 * It never calls the network, and nothing here is a real security control.
 * Delete this file when the real endpoints are wired.
 *
 * Fixtures (so every screen state can be reached while building the UI):
 *
 *   Send / resend, by the last four digits of the phone number:
 *     …0000  → phone already registered (phone_exists)
 *     …1111  → unsupported number (unsupported_phone)
 *     …2222  → network failure (network)
 *     anything else → code sent
 *
 *   Verify (the code must be 123456 to succeed):
 *     any other code → incorrect_code
 *     3 wrong codes in a row → too_many_attempts, until a new code is sent
 */
import { PhoneOtpError, type PhoneOtpService } from './phone-otp.types';

const MOCK_LATENCY_MS = 400;
const VALID_MOCK_CODE = '123456';
const MAX_WRONG_ATTEMPTS = 3;

/** Wrong-code attempts per phone number since the last code was sent. */
const wrongAttempts = new Map<string, number>();

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

function failIfFixture(localPhone: string): void {
  if (localPhone.endsWith('0000')) {
    throw new PhoneOtpError('phone_exists');
  }
  if (localPhone.endsWith('1111')) {
    throw new PhoneOtpError('unsupported_phone');
  }
  if (localPhone.endsWith('2222')) {
    throw new PhoneOtpError('network');
  }
}

async function sendOrResend(localPhone: string): Promise<void> {
  await wait();
  failIfFixture(localPhone);
  wrongAttempts.delete(localPhone);
}

export const mockPhoneOtpService: PhoneOtpService = {
  sendCode: sendOrResend,
  resendCode: sendOrResend,

  async verifyCode(localPhone, code) {
    await wait();
    const attempts = wrongAttempts.get(localPhone) ?? 0;
    if (attempts >= MAX_WRONG_ATTEMPTS) {
      throw new PhoneOtpError('too_many_attempts');
    }
    if (code !== VALID_MOCK_CODE) {
      wrongAttempts.set(localPhone, attempts + 1);
      if (attempts + 1 >= MAX_WRONG_ATTEMPTS) {
        throw new PhoneOtpError('too_many_attempts');
      }
      throw new PhoneOtpError('incorrect_code');
    }
    wrongAttempts.delete(localPhone);
  },
};
