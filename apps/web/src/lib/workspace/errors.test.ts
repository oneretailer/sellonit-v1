import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { presentError } from './errors';

describe('workspace API error presentation', () => {
  it.each([
    ['UNAUTHENTICATED', 'auth', false],
    ['FORBIDDEN', 'access', false],
    ['SUPPLIER_NOT_APPROVED', 'access', false],
    ['NOT_FOUND', 'missing', false],
    ['VALIDATION_FAILED', 'validation', true],
    ['INVALID_STATE_TRANSITION', 'conflict', false],
    ['DUPLICATE_SKU', 'validation', true],
    ['LIMIT_REACHED', 'access', false],
  ] as const)('maps %s to a stable %s presentation', (code, kind, retryable) => {
    expect(presentError(new ApiError(400, code, 'Server message'))).toMatchObject({ kind, retryable });
  });
  it('treats transport failure as retryable without exposing internals', () => {
    expect(presentError(new NetworkError())).toMatchObject({ kind: 'network', retryable: true });
  });
});
