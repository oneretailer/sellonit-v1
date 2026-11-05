import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { mapDashboardError } from './access';

describe('central dashboard error mapping', () => {
  it('maps network failures and 5xx to load-failed', () => {
    expect(mapDashboardError(new NetworkError())).toBe('load-failed');
    expect(mapDashboardError(new ApiError(500, null, 'boom'))).toBe('load-failed');
    expect(mapDashboardError(new ApiError(503, null, 'down'))).toBe('load-failed');
    expect(mapDashboardError(new Error('unknown'))).toBe('load-failed');
  });

  it('maps 401 to the existing session recovery', () => {
    expect(mapDashboardError(new ApiError(401, null, 'expired'))).toBe('session-expired');
  });

  it('maps missing businesses to business-unavailable', () => {
    expect(mapDashboardError(new ApiError(404, null, 'gone'))).toBe('business-unavailable');
    expect(mapDashboardError(new ApiError(410, null, 'gone'))).toBe('business-unavailable');
  });

  it('maps 403 to business-denied', () => {
    expect(mapDashboardError(new ApiError(403, null, 'no'))).toBe('business-denied');
  });
});
