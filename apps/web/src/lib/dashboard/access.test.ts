import { describe, expect, it } from 'vitest';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, NetworkError } from '@/lib/api-client';
import { mapDashboardError } from './access';

describe('central dashboard error mapping', () => {
  it('maps network failures, unimplemented routes, and 5xx to load-failed', () => {
    expect(mapDashboardError(new NetworkError())).toBe('load-failed');
    expect(mapDashboardError(new ApiError(500, null, 'boom'))).toBe('load-failed');
    expect(mapDashboardError(new ApiError(503, null, 'down'))).toBe('load-failed');
    expect(mapDashboardError(new ApiError(404, ENDPOINT_NOT_IMPLEMENTED_CODE, 'absent'))).toBe(
      'load-failed',
    );
    expect(mapDashboardError(new Error('unknown'))).toBe('load-failed');
  });

  it('maps 401 and UNAUTHORIZED to session-expired', () => {
    expect(mapDashboardError(new ApiError(401, null, 'expired'))).toBe('session-expired');
    expect(mapDashboardError(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'))).toBe(
      'session-expired',
    );
  });

  it('maps missing, suspended, or non-supplier businesses to business-unavailable', () => {
    expect(mapDashboardError(new ApiError(404, 'NOT_FOUND', 'gone'))).toBe('business-unavailable');
    expect(mapDashboardError(new ApiError(410, null, 'gone'))).toBe('business-unavailable');
    expect(mapDashboardError(new ApiError(403, 'NOT_A_SUPPLIER', 'not supplier'))).toBe(
      'business-unavailable',
    );
    expect(mapDashboardError(new ApiError(403, 'BUSINESS_SUSPENDED', 'suspended'))).toBe(
      'business-unavailable',
    );
  });

  it('maps BUSINESS_REQUIRED to no-business and 403 FORBIDDEN to business-denied', () => {
    expect(
      mapDashboardError(new ApiError(400, 'BUSINESS_REQUIRED', 'Create a business first')),
    ).toBe('no-business');
    expect(mapDashboardError(new ApiError(403, 'FORBIDDEN', 'no'))).toBe('business-denied');
  });
});
