/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOnboardingBusiness, readOnboardingBusiness } from '@/lib/auth/flowState';
import { getActiveBusinessId } from '@/lib/business/activeBusiness';
import {
  NON_SUPPLIER_BUSINESS_CREATION_ENABLED,
  businessApi,
  canCreateBusiness,
  httpBusinessApi,
} from './businessApi';

const post = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: { POST: post },
  newIdempotencyKey: () => 'idem-test',
  unwrap: (result: Promise<{ data?: unknown; error?: unknown }>) =>
    result.then((body) => {
      if (body.error || body.data === undefined) throw new Error('request failed');
      return body.data;
    }),
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args) as Promise<unknown>,
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingBusiness();
  post.mockReset();
  apiFetchMock.mockReset();
});

describe('business creation feature flag', () => {
  it('only lets the supplier track advance while the flag is off', () => {
    expect(NON_SUPPLIER_BUSINESS_CREATION_ENABLED).toBe(false);
    expect(canCreateBusiness('supplier')).toBe(true);
    expect(canCreateBusiness('retailer')).toBe(false);
    expect(canCreateBusiness('entrepreneur')).toBe(false);
    expect(canCreateBusiness(null)).toBe(false);
  });

  it('selects the typed HTTP adapter; no local adapter remains', () => {
    expect(businessApi).toBe(httpBusinessApi);
  });
});

describe('HTTP business adapter', () => {
  it('creates via POST /businesses, persists supplier profile via PUT /supplier/:businessId/profile, sets active business, and writes draft', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          id: 'biz-1',
          name: 'Okechukwu Fashion',
          slug: 'okechukwu-fashion-1234',
          type: 'SUPPLIER',
        },
      },
    });
    apiFetchMock.mockResolvedValue({
      data: { id: 'prof-1', businessId: 'biz-1', status: 'DRAFT' },
    });

    const created = await httpBusinessApi.createBusiness(
      {
        name: '  Okechukwu Fashion  ',
        phone: '08031234567',
        email: 'hello@example.com',
        description: '  Wholesale fashion supplier  ',
        role: 'supplier',
      },
      'idem-1',
    );

    expect(created).toEqual({
      id: 'biz-1',
      name: 'Okechukwu Fashion',
      slug: 'okechukwu-fashion-1234',
      type: 'SUPPLIER',
    });
    expect(post).toHaveBeenCalledWith(
      '/businesses',
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'idem-1' },
        body: {
          name: 'Okechukwu Fashion',
          type: 'SUPPLIER',
          phone: '08031234567',
          email: 'hello@example.com',
        },
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/supplier/biz-1/profile',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          businessId: 'biz-1',
          legalName: 'Okechukwu Fashion',
          contactPhone: '08031234567',
          description: 'Wholesale fashion supplier',
        }),
      }),
    );
    expect(getActiveBusinessId()).toBe('biz-1');
    const draft = readOnboardingBusiness();
    expect(draft?.name).toBe('Okechukwu Fashion');
    expect(draft?.description).toBe('Wholesale fashion supplier');
  });

  it('does not write a local draft when POST /businesses rejects', async () => {
    post.mockResolvedValue({ error: { code: 'VALIDATION_ERROR' } });
    await expect(
      httpBusinessApi.createBusiness({
        name: 'Okechukwu Fashion',
        phone: '08031234567',
        email: 'hello@example.com',
        description: '',
        role: 'supplier',
      }),
    ).rejects.toThrow();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(readOnboardingBusiness()).toBeNull();
  });
});
