/**
 * Maps backend error codes to short, user-facing messages.
 *
 * Known codes are listed explicitly; unknown codes fall back to the backend's
 * own message, which is safe to display by construction (the API never
 * returns stack traces or internals). Raw exceptions are never shown.
 *
 * `INVALID_VERIFICATION_TOKEN` is used by the verification link; the message
 * is written for that screen.
 */
import { ApiError, NetworkError } from '@/lib/api-client';

const NETWORK_MESSAGE = 'We could not reach Sellonit. Check your connection and try again.';
const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.';

export function authErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return NETWORK_MESSAGE;
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
        return 'That verification code or link is invalid or has expired.';
      case 'INVALID_CREDENTIALS':
        return 'Email or password is incorrect.';
      case 'EMAIL_NOT_VERIFIED':
        return 'Verify your email before logging in. Check your inbox for the verification link.';
      case 'ACCOUNT_UNAVAILABLE':
        return 'This account is not active. Contact support if you think this is a mistake.';
      case 'VALIDATION_ERROR':
        return 'Please check the details you entered and try again.';
      case 'UNAUTHORIZED':
        return 'Your session has expired. Log in again to continue.';
      case 'USER_NOT_FOUND':
        return 'We could not find that account. Log in to continue.';
      case 'INTERNAL_ERROR':
        return 'Something went wrong on our side. Your account may already exist, so try logging in with this email.';
      default:
        return error.message;
    }
  }
  return UNKNOWN_MESSAGE;
}

/** Errors from POST /auth/verify-email, shown on the link landing route. */
export function emailLinkErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_VERIFICATION_TOKEN') {
    return 'This verification link is invalid or has expired.';
  }
  return authErrorMessage(error);
}

/**
 * Whether a failed verification may succeed if the same request is sent again.
 * Network failures and server errors are transient (the token is only consumed
 * on success, so retrying is safe); an invalid or expired token is not.
 */
export function isRetryableAuthError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  return error instanceof ApiError && error.status >= 500;
}
