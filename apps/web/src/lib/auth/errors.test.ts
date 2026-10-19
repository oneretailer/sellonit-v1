import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { emailLinkErrorMessage, isRetryableAuthError } from './errors';

describe('emailLinkErrorMessage', () => {
  it('reports an expired or used link', () => {
    expect(emailLinkErrorMessage(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'This verification link is invalid or has expired.',
    );
  });

  it('falls back to the shared mapping for other failures', () => {
    expect(emailLinkErrorMessage(new NetworkError())).toContain('could not reach Sellonit');
  });
});

describe('isRetryableAuthError', () => {
  it('allows retrying network failures and server errors', () => {
    expect(isRetryableAuthError(new NetworkError())).toBe(true);
    expect(isRetryableAuthError(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBe(true);
    expect(isRetryableAuthError(new ApiError(503, null, 'x'))).toBe(true);
  });

  it('does not retry invalid tokens or client errors', () => {
    expect(isRetryableAuthError(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(false);
    expect(isRetryableAuthError(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe(false);
    expect(isRetryableAuthError(new Error('boom'))).toBe(false);
  });
});
