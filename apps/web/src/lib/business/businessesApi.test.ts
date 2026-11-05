import { afterEach, describe, expect, it, vi } from 'vitest';
import { businessRoleLabel, businessTypeLabel, listBusinesses } from './businessesApi';
import { ApiError } from '@/lib/api-client';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(String(url));
    return Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    }));
  });
  return { calls };
}

describe('business switcher data adapter', () => {
  it('normalizes the real GET /businesses membership response', async () => {
    const { calls } = stubFetch(200, {
      data: [
        { id: 'biz-1', name: 'Okechukwu Fashion', type: 'ENTERPRISE', memberships: [{ userId: 'user-1', role: 'OWNER' }] },
        { id: 'biz-2', name: 'Lagos Fabrics', type: 'ENTERPRISE', memberships: [{ userId: 'user-1', role: 'ADMIN' }, { userId: 'other', role: 'OWNER' }] },
        { id: 'biz-3', name: 'No Membership', type: 'RETAILER' },
      ],
    });
    const rows = await listBusinesses('user-1');
    expect(calls[0]).toContain('/api/v1/businesses');
    expect(rows).toEqual([
      { id: 'biz-1', name: 'Okechukwu Fashion', type: 'ENTERPRISE', role: 'OWNER' },
      { id: 'biz-2', name: 'Lagos Fabrics', type: 'ENTERPRISE', role: 'ADMIN' },
      { id: 'biz-3', name: 'No Membership', type: 'RETAILER', role: 'MEMBER' },
    ]);
  });

  it('surfaces API errors instead of returning fake businesses', async () => {
    stubFetch(500, { error: { message: 'boom' } });
    await expect(listBusinesses('user-1')).rejects.toBeInstanceOf(ApiError);
  });

  it('labels types and roles for the menu secondary line', () => {
    expect(businessTypeLabel('ENTERPRISE')).toBe('Supplier');
    expect(businessTypeLabel('RETAILER')).toBe('Retailer');
    expect(businessTypeLabel('ENTREPRENEUR')).toBe('Entrepreneur');
    expect(businessRoleLabel('OWNER')).toBe('Owner');
    expect(businessRoleLabel('ADMIN')).toBe('Admin');
    expect(businessRoleLabel('MEMBER')).toBe('Member');
  });
});
