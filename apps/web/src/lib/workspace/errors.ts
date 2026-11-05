import { ApiError, NetworkError } from '@/lib/api-client';

export type ErrorPresentation = { message: string; retryable: boolean; kind: 'auth' | 'access' | 'missing' | 'conflict' | 'validation' | 'network' | 'unknown' };

export function presentError(error: unknown): ErrorPresentation {
  if (error instanceof NetworkError) return { message: 'You appear to be offline. Check your connection and try again.', retryable: true, kind: 'network' };
  if (!(error instanceof ApiError)) return { message: 'Something went wrong. Please try again.', retryable: true, kind: 'unknown' };
  switch (error.code) {
    case null: break;
    case 'UNAUTHENTICATED': return { message: 'Your session has expired. Log in again to continue.', retryable: false, kind: 'auth' };
    case 'FORBIDDEN': return { message: 'You do not have permission to perform this action.', retryable: false, kind: 'access' };
    case 'SUPPLIER_NOT_APPROVED': return { message: 'Your supplier account must be approved before publishing.', retryable: false, kind: 'access' };
    case 'NOT_FOUND': return { message: 'This item no longer exists or is not available to your business.', retryable: false, kind: 'missing' };
    case 'VALIDATION_FAILED': return { message: 'Check the highlighted fields and try again.', retryable: true, kind: 'validation' };
    case 'INVALID_STATE_TRANSITION': return { message: 'This item changed since you opened it. The latest status has been loaded.', retryable: false, kind: 'conflict' };
    case 'DUPLICATE_SKU': return { message: 'This SKU already exists in your business. Use a different SKU.', retryable: true, kind: 'validation' };
    case 'LIMIT_REACHED': return { message: 'Your plan limit has been reached. Upgrade or archive an item before trying again.', retryable: false, kind: 'access' };
  }
  if (error.status === 401) return { message: 'Your session has expired. Log in again to continue.', retryable: false, kind: 'auth' };
  if (error.status === 403) return { message: 'You do not have access to this workspace.', retryable: false, kind: 'access' };
  if (error.status === 404) return { message: 'This item could not be found.', retryable: false, kind: 'missing' };
  return { message: error.message, retryable: error.status >= 500, kind: 'unknown' };
}
