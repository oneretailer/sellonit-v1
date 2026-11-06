import { describe, expect, it } from 'vitest';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, NetworkError } from '@/lib/api-client';
import { presentError } from './errors';

describe('workspace API error presentation', () => {
  it.each([
    ['UNAUTHORIZED', 'auth', false],
    ['UNAUTHENTICATED', 'auth', false],
    ['FORBIDDEN', 'access', false],
    ['NOT_A_SUPPLIER', 'access', false],
    ['ACCOUNT_UNAVAILABLE', 'access', false],
    ['BUSINESS_SUSPENDED', 'access', false],
    ['SUPPLIER_NOT_APPROVED', 'access', false],
    ['NOT_FOUND', 'missing', false],
    [ENDPOINT_NOT_IMPLEMENTED_CODE, 'missing', false],
    ['VALIDATION_ERROR', 'validation', true],
    ['VALIDATION_FAILED', 'validation', true],
    ['BUSINESS_REQUIRED', 'validation', true],
    ['PROFILE_REQUIRED', 'validation', true],
    ['INVALID_STATE_TRANSITION', 'conflict', false],
    ['DUPLICATE_SKU', 'validation', true],
    ['LIMIT_REACHED', 'access', false],
  ] as const)('maps %s to a stable %s presentation', (code, kind, retryable) => {
    expect(presentError(new ApiError(400, code, 'Server message'))).toMatchObject({
      kind,
      retryable,
    });
  });

  it('preserves specific backend VALIDATION_ERROR message when no field map is returned', () => {
    expect(
      presentError(new ApiError(400, 'VALIDATION_ERROR', 'A business name is required')),
    ).toEqual({
      message: 'A business name is required',
      retryable: true,
      kind: 'validation',
    });
  });

  it('treats transport failure as retryable without exposing internals', () => {
    expect(presentError(new NetworkError())).toMatchObject({ kind: 'network', retryable: true });
  });
});
