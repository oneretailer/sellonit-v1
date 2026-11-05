import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  businessPlanLabel,
  businessRoleLabel,
  businessTypeLabel,
  listBusinesses,
} from './businessesApi';
import { ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, apiFetch, isEndpointNotImplemented } from '@/lib/api-client';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown, contentType = 'application/json'): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(String(url));
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(
      new Response(payload, {
        status,
        headers: { 'content-type': contentType },
      }),
    );
  });
  return { calls };
}

describe('business switcher data adapter', () => {
  it('normalizes the real GET /businesses membership, status, and subscription response', async () => {
    const { calls } = stubFetch(200, {
      data: [
        {
          id: 'biz-1',
          name: 'Okechukwu Fashion',
          slug: 'okechukwu-fashion',
          type: 'SUPPLIER',
          status: 'ACTIVE',
          activeSubscription: { status: 'ACTIVE', plan: { key: 'ENTERPRISE', name: 'Enterprise' } },
          memberships: [{ userId: 'user-1', role: 'OWNER' }],
        },
        {
          id: 'biz-2',
          name: 'Lagos Fabrics',
          type: 'SUPPLIER',
          status: 'SUSPENDED',
          plan: 'ENTERPRISE_PLUS',
          memberships: [
            { userId: 'user-1', role: 'MANAGER' },
            { userId: 'other', role: 'OWNER' },
          ],
        },
        { id: 'biz-3', name: 'No Membership', type: 'RETAILER' },
      ],
    });
    const rows = await listBusinesses('user-1');
    expect(calls[0]).toContain('/api/v1/businesses');
    expect(rows).toEqual([
      {
        id: 'biz-1',
        name: 'Okechukwu Fashion',
        slug: 'okechukwu-fashion',
        type: 'SUPPLIER',
        status: 'ACTIVE',
        role: 'OWNER',
        plan: 'ENTERPRISE',
      },
      {
        id: 'biz-2',
        name: 'Lagos Fabrics',
        type: 'SUPPLIER',
        status: 'SUSPENDED',
        role: 'MANAGER',
        plan: 'ENTERPRISE_PLUS',
      },
      {
        id: 'biz-3',
        name: 'No Membership',
        type: 'RETAILER',
        status: 'ACTIVE',
        role: 'STAFF',
        plan: null,
      },
    ]);
  });

  it('surfaces API errors instead of returning fake businesses', async () => {
    stubFetch(500, { error: { message: 'boom' } });
    await expect(listBusinesses('user-1')).rejects.toBeInstanceOf(ApiError);
  });

  it('detects Express text/html 404 routes as ENDPOINT_NOT_IMPLEMENTED without leaking HTML', async () => {
    stubFetch(
      404,
      '<!DOCTYPE html><html lang="en"><body><pre>Cannot GET /api/v1/session/context</pre></body></html>',
      'text/html; charset=utf-8',
    );
    let caught: unknown;
    try {
      await apiFetch('/session/context');
    } catch (error) {
      caught = error;
    }
    expect(isEndpointNotImplemented(caught)).toBe(true);
    expect((caught as ApiError).code).toBe(ENDPOINT_NOT_IMPLEMENTED_CODE);
    expect((caught as ApiError).message).not.toContain('<!DOCTYPE html>');
  });

  it('labels types, roles, and subscription plans for the menu secondary line', () => {
    expect(businessTypeLabel('SUPPLIER')).toBe('Supplier');
    expect(businessTypeLabel('RETAILER')).toBe('Retailer');
    expect(businessRoleLabel('OWNER')).toBe('Owner');
    expect(businessRoleLabel('MANAGER')).toBe('Manager');
    expect(businessRoleLabel('STAFF')).toBe('Staff');
    expect(businessPlanLabel('ENTERPRISE')).toBe('Enterprise');
    expect(businessPlanLabel('ENTERPRISE_PLUS')).toBe('Enterprise Plus');
    expect(businessPlanLabel(null)).toBeNull();
  });
});
