/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeBusinessSubscription, listSuppliers, transitionSupplier } from './adminApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adminApi (PR #18 contract)', () => {
  it('passes search query parameter to GET /admin/suppliers via typed OpenAPI client', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [],
            meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    await listSuppliers({
      status: 'PENDING_REVIEW',
      page: 1,
      pageSize: 20,
      search: '  Okechukwu  ',
    });

    expect(urls[0]).toContain('/api/v1/admin/suppliers?');
    expect(urls[0]).toContain('status=PENDING_REVIEW');
    expect(urls[0]).toContain('search=Okechukwu');
  });

  it('sends optional note on POST /admin/suppliers/:id/approve', async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input instanceof Request) {
        requests.push({
          url: input.url,
          method: input.method,
          body: JSON.parse(await input.clone().text()),
        });
      } else {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });
      }
      return new Response(
        JSON.stringify({
          data: {
            id: 'sup-1',
            businessName: 'Okechukwu Fashion',
            ownerName: 'Ada',
            ownerPhone: '0803',
            ownerEmail: 'ada@example.com',
            description: '',
            profile: { businessId: 'sup-1', status: 'APPROVED' },
            submittedAt: null,
            status: 'APPROVED',
            plan: 'ENTERPRISE_PLUS',
            auditHistory: [],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    await transitionSupplier('sup-1', 'approve', {
      plan: 'ENTERPRISE_PLUS',
      note: 'Verified CAC',
    });

    expect(requests[0]?.url).toContain('/api/v1/admin/suppliers/sup-1/approve');
    expect(requests[0]?.body).toEqual({
      plan: 'ENTERPRISE_PLUS',
      note: 'Verified CAC',
    });
  });

  it('posts targetPlan + confirm=true to POST /admin/businesses/:id/subscription/change', async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input instanceof Request) {
        requests.push({
          url: input.url,
          method: input.method,
          body: JSON.parse(await input.clone().text()),
        });
      } else {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });
      }
      return new Response(
        JSON.stringify({
          data: {
            businessId: 'sup-1',
            plan: 'ENTERPRISE_PLUS',
            status: 'ACTIVE',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const result = await changeBusinessSubscription('sup-1', {
      targetPlan: 'ENTERPRISE_PLUS',
    });

    expect(requests[0]?.url).toContain('/api/v1/admin/businesses/sup-1/subscription/change');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toEqual({
      targetPlan: 'ENTERPRISE_PLUS',
      confirm: true,
    });
    expect(result).toEqual({
      businessId: 'sup-1',
      plan: 'ENTERPRISE_PLUS',
      status: 'ACTIVE',
    });
  });
});
