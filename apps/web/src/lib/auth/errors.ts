/**
 * Maps backend error codes to short, user-facing messages.
 *
 * Known codes are listed explicitly; unknown codes fall back to the backend's
 * own message, which is safe to display by construction (the API never
 * returns stack traces or internals). Raw exceptions are never shown.
 */
import { ApiError, NetworkError } from '@/lib/api-client';

export function authErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'We could not reach Sellonit. Check your connection and try again.';
  }
  if (error instanceof ApiError) {
    const code = error.code;
    if (code === null) {
      return error.message;
    }
    switch (code) {
      case 'EMAIL_ALREADY_EXISTS':
        return 'An account with this email already exists. You can log in instead.';
      case 'INVALID_PHONE':
        return 'Enter a valid Nigerian phone number.';
      case 'INVALID_VERIFICATION_TOKEN':
        return 'That verification code or link is invalid, expired, or already used. Check it and try again.';
      case 'INVALID_CREDENTIALS':
        return 'Email or password is incorrect.';
      case 'EMAIL_NOT_VERIFIED':
        return 'Verify your email before logging in — check your inbox for the verification link.';
      case 'ACCOUNT_UNAVAILABLE':
        return 'This account is not active. Contact support if you think this is a mistake.';
      case 'VALIDATION_ERROR':
        return 'Please check the details you entered and try again.';
      case 'UNAUTHORIZED':
        return 'Your session has expired. Log in again to continue.';
      case 'INTERNAL_ERROR':
        return 'Something went wrong on our side. Please try again in a moment.';
      case 'USER_NOT_FOUND':
        return 'We could not find that account. Log in to continue.';
      default:
        return error.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
