/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOnboardingBusiness,
  readOnboardingBusiness,
} from '@/lib/auth/flowState';
import {
  NON_SUPPLIER_BUSINESS_CREATION_ENABLED,
  businessApi,
  canCreateBusiness,
  httpBusinessApi,
} from './businessApi';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  api: { POST: post },
  newIdempotencyKey: () => 'idem-test',
  unwrap: (result: Promise<{ data?: unknown; error?: unknown }>) => result.then((body) => {
    if (body.error || body.data === undefined) throw new Error('request failed');
    return body.data;
  }),
}));

beforeEach(() => {
  sessionStorage.clear();
  clearOnboardingBusiness();
  post.mockReset();
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
  it('posts the full payload and only writes the local draft after server success', async () => {
    post.mockResolvedValue({ data: { data: { id: 'biz-1', name: 'Okechukwu Fashion', type: 'ENTERPRISE' } } });
    const created = await httpBusinessApi.createBusiness({
      name: '  Okechukwu Fashion  ',
      phone: '08031234567',
      email: 'Hello@Example.com',
      description: '  Fashion retailer  ',
      role: 'supplier',
    }, 'idem-1');

    expect(created).toEqual({ id: 'biz-1', name: 'Okechukwu Fashion', type: 'ENTERPRISE' });
    expect(post).toHaveBeenCalledWith('/onboarding/businesses', expect.objectContaining({
      params: { header: { 'Idempotency-Key': 'idem-1' } },
      body: { name: 'Okechukwu Fashion', phone: '08031234567', email: 'Hello@Example.com', description: 'Fashion retailer', accountType: 'supplier' },
    }));
    const draft = readOnboardingBusiness();
    expect(draft?.name).toBe('Okechukwu Fashion');
    expect(draft?.phone).toBe('08031234567');
    expect(draft?.email).toBe('Hello@Example.com');
  });

  it('does not write a local draft when the server rejects', async () => {
    post.mockResolvedValue({ error: { code: 'VALIDATION_ERROR' } });
    await expect(httpBusinessApi.createBusiness({
      name: 'Okechukwu Fashion', phone: '08031234567', email: 'hello@example.com', description: '', role: 'supplier',
    })).rejects.toThrow();
    expect(readOnboardingBusiness()).toBeNull();
  });
});
