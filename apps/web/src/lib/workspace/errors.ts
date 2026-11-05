import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, NetworkError } from '@/lib/api-client';

export type ErrorPresentation = {
  message: string;
  retryable: boolean;
  kind: 'auth' | 'access' | 'missing' | 'conflict' | 'validation' | 'network' | 'unknown';
};

export function presentError(error: unknown): ErrorPresentation {
  if (error instanceof NetworkError) {
    return {
      message: 'You appear to be offline. Check your connection and try again.',
      retryable: true,
      kind: 'network',
    };
  }
  if (!(error instanceof ApiError)) {
    return { message: 'Something went wrong. Please try again.', retryable: true, kind: 'unknown' };
  }
  switch (error.code) {
    case null:
      break;
    case 'UNAUTHORIZED':
    case 'UNAUTHENTICATED':
      return {
        message: 'Your session has expired. Log in again to continue.',
        retryable: false,
        kind: 'auth',
      };
    case 'FORBIDDEN':
    case 'UNAUTHORIZED_BUSINESS_ACCESS':
      return {
        message: 'You do not have permission to perform this action.',
        retryable: false,
        kind: 'access',
      };
    case 'ACCOUNT_UNAVAILABLE':
      return {
        message: 'This account is not active. Contact support if you think this is a mistake.',
        retryable: false,
        kind: 'access',
      };
    case 'BUSINESS_SUSPENDED':
      return {
        message: 'This business is currently suspended. Switch businesses or contact support.',
        retryable: false,
        kind: 'access',
      };
    case 'NOT_A_SUPPLIER':
      return {
        message: 'This business is not a supplier business. Switch to a supplier business to continue.',
        retryable: false,
        kind: 'access',
      };
    case 'SUPPLIER_NOT_APPROVED':
      return {
        message: 'Your supplier account must be approved before publishing.',
        retryable: false,
        kind: 'access',
      };
    case ENDPOINT_NOT_IMPLEMENTED_CODE:
      return {
        message: 'This feature is not available on the server yet.',
        retryable: false,
        kind: 'missing',
      };
    case 'NOT_FOUND':
      return {
        message: 'This item no longer exists or is not available to your business.',
        retryable: false,
        kind: 'missing',
      };
    case 'BUSINESS_REQUIRED':
    case 'PROFILE_REQUIRED':
      return {
        message: error.message || 'Complete the required business details and try again.',
        retryable: true,
        kind: 'validation',
      };
    case 'VALIDATION_ERROR':
      return {
        message:
          error.fields && Object.keys(error.fields).length > 0
            ? 'Check the highlighted fields and try again.'
            : error.message || 'Check the highlighted fields and try again.',
        retryable: true,
        kind: 'validation',
      };
    case 'VALIDATION_FAILED':
      return {
        message: 'Check the highlighted fields and try again.',
        retryable: true,
        kind: 'validation',
      };
    case 'INVALID_STATE_TRANSITION':
      return {
        message: 'This item changed since you opened it. The latest status has been loaded.',
        retryable: false,
        kind: 'conflict',
      };
    case 'DUPLICATE_SKU':
      return {
        message: 'This SKU already exists in your business. Use a different SKU.',
        retryable: true,
        kind: 'validation',
      };
    case 'LIMIT_REACHED':
      return {
        message: 'Your plan limit has been reached. Upgrade or archive an item before trying again.',
        retryable: false,
        kind: 'access',
      };
  }
  if (error.status === 401) {
    return {
      message: 'Your session has expired. Log in again to continue.',
      retryable: false,
      kind: 'auth',
    };
  }
  if (error.status === 403) {
    return {
      message: 'You do not have access to this workspace.',
      retryable: false,
      kind: 'access',
    };
  }
  if (error.status === 404) {
    return { message: 'This item could not be found.', retryable: false, kind: 'missing' };
  }
  return { message: error.message, retryable: error.status >= 500, kind: 'unknown' };
}
