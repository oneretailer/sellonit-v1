/**
 * ⚠️ FOR REMOVAL — DEV-ONLY MOCK ⚠️
 *
 * Lets the Create account → Verify email flow be tested before the backend
 * contract (docs/auth-registration-contract.md) is implemented. Enabled only
 * when NEXT_PUBLIC_MOCK_AUTH=true; the flag is OFF by default, so production
 * and normal development always talk to the real API. Nothing here is a
 * security control and no password is ever stored or logged.
 *
 * Fixtures:
 *   register:  email starting with "taken@"  → 409 (email already registered)
 *              email starting with "rate@"   → 429 (rate limited)
 *              email starting with "fail@"   → 500 (server error)
 *              otherwise                     → 201 success
 *   resend:    email starting with "rate@"   → 429, otherwise 202
 *   verify:    token "expired" or "used"     → 400 INVALID_VERIFICATION_TOKEN
 *              otherwise                     → 200 verified
 */
import { ApiError } from '@/lib/api-client';
import { splitFullName } from '@/lib/validation/auth';
import type {
  RegisterUserRequest,
  RegisterUserResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  VerifyEmailResponse,
} from './types';

const MOCK_LATENCY_MS = 600;

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

export async function mockRegisterUser(input: RegisterUserRequest): Promise<RegisterUserResponse> {
  await wait();
  const email = input.email.trim().toLowerCase();
  if (email.startsWith('taken@')) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }
  if (email.startsWith('rate@')) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts');
  }
  if (email.startsWith('fail@')) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Server error');
  }
  const { firstName, lastName } = splitFullName(input.fullName);
  return {
    data: {
      id: 'mock-user',
      email,
      firstName,
      lastName,
      phone: null,
      status: 'ACTIVE',
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function mockResendVerification(
  _input: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  await wait();
  return { data: { sent: true } };
}

export async function mockVerifyEmail(token: string): Promise<VerifyEmailResponse> {
  await wait();
  if (token === 'expired' || token === 'used') {
    throw new ApiError(
      400,
      'INVALID_VERIFICATION_TOKEN',
      'Verification token is invalid or expired',
    );
  }
  return { data: { verified: true } };
}
