import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { ROLE_OPTIONS } from './roles';
import {
  businessTypeForRole,
  httpRoleApi,
  localRoleApi,
  nextRouteForBusinessType,
  roleApi,
  roleForBusinessType,
} from './roleApi';

type Captured = { url: string; method: string; body: unknown };

function stubFetch(status: number, body: unknown = null): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: String(init.method),
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    const json = body !== null;
    return Promise.resolve(
      new Response(json ? JSON.stringify(body) : null, {
        status,
        headers: json ? { 'content-type': 'application/json' } : {},
      }),
    );
  });
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('role API selection and local recommendations', () => {
  it('maps supplier to Overview and entrepreneur/retailer to coming soon', async () => {
    for (const option of ROLE_OPTIONS) {
      const nextRoute =
        option.recommendationKey === 'supplier' ? '/dashboard/overview' : '/dashboard/coming-soon';
      await expect(localRoleApi.saveRole(option.recommendationKey)).resolves.toEqual({
        role: option.recommendationKey,
        track: option.recommendationKey,
        nextRoute,
      });
    }
  });

  it('saves the onboarding role through the business-intent endpoint', () => {
    expect(roleApi).toBe(httpRoleApi);
  });

  it('derives a recommendation without issuing another save request', () => {
    expect(roleApi.getRecommendation('supplier')).toEqual({
      role: 'supplier',
      track: 'supplier',
      nextRoute: '/dashboard/overview',
    });
    expect(roleApi.getRecommendation('retailer').nextRoute).toBe('/dashboard/coming-soon');
    expect(roleApi.getRecommendation('entrepreneur').nextRoute).toBe('/dashboard/coming-soon');
  });

  it('sends PUT /auth/business-intent with the backend BusinessType for each role', async () => {
    const { calls } = stubFetch(200, { data: { id: 'u1' } });
    await expect(roleApi.saveRole('supplier')).resolves.toEqual({
      role: 'supplier',
      track: 'supplier',
      nextRoute: '/dashboard/overview',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/business-intent',
      method: 'PUT',
      body: { businessType: 'ENTERPRISE' },
    });
  });

  it('surfaces a failed save so the screen can keep the selection', async () => {
    stubFetch(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    await expect(httpRoleApi.saveRole('retailer')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('BusinessType mapping', () => {
  it('maps each onboarding role to the backend enum', () => {
    expect(businessTypeForRole('retailer')).toBe('RETAILER');
    expect(businessTypeForRole('entrepreneur')).toBe('ENTREPRENEUR');
    expect(businessTypeForRole('supplier')).toBe('ENTERPRISE');
  });

  it('round-trips a saved intent back to a role and route', () => {
    expect(roleForBusinessType('ENTERPRISE')).toBe('supplier');
    expect(roleForBusinessType('RETAILER')).toBe('retailer');
    expect(roleForBusinessType('ENTREPRENEUR')).toBe('entrepreneur');
    expect(nextRouteForBusinessType('ENTERPRISE')).toBe('/dashboard/overview');
    expect(nextRouteForBusinessType('RETAILER')).toBe('/dashboard/coming-soon');
  });
});
