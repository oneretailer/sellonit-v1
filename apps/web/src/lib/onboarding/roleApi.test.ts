import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { AuthUser } from '@/lib/auth/types';
import { businessTypeForRole, httpRoleApi, roleApi, roleForBusinessType } from './roleApi';
import { ROLE_OPTIONS } from './roles';

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

const SAVED_USER = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  onboardingIntent: 'ENTERPRISE',
} as AuthUser;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('role API', () => {
  it('is the HTTP implementation', () => {
    expect(roleApi).toBe(httpRoleApi);
  });

  it('sends PUT /auth/business-intent with the backend BusinessType for each role', async () => {
    const { calls } = stubFetch(200, { data: SAVED_USER });
    await expect(roleApi.saveRole('supplier')).resolves.toEqual({
      user: SAVED_USER,
      businessType: 'ENTERPRISE',
    });
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/business-intent',
      method: 'PUT',
      body: { businessType: 'ENTERPRISE' },
    });

    for (const option of ROLE_OPTIONS) {
      expect(businessTypeForRole(option.id)).toBe(
        option.id === 'supplier'
          ? 'ENTERPRISE'
          : option.id === 'retailer'
            ? 'RETAILER'
            : 'ENTREPRENEUR',
      );
    }
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

  it('round-trips a saved intent back to a role', () => {
    expect(roleForBusinessType('ENTERPRISE')).toBe('supplier');
    expect(roleForBusinessType('RETAILER')).toBe('retailer');
    expect(roleForBusinessType('ENTREPRENEUR')).toBe('entrepreneur');
  });
});
