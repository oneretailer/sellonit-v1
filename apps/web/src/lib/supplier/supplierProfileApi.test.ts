import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSupplierProfile,
  isSupplierProfileStepComplete,
  submitSupplierProfile,
  upsertSupplierProfile,
} from './supplierProfileApi';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; method: string; body: string | undefined }[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return calls;
}

describe('supplierProfileApi', () => {
  it('fetches GET /supplier/:businessId/profile including synthetic DRAFT before first save', async () => {
    const calls = stubFetch(200, { data: { businessId: 'biz-1', status: 'DRAFT' } });
    const profile = await getSupplierProfile('biz-1');
    expect(calls[0]).toEqual({
      url: '/api/v1/supplier/biz-1/profile',
      method: 'GET',
      body: undefined,
    });
    expect(profile).toEqual({ businessId: 'biz-1', status: 'DRAFT' });
    expect(isSupplierProfileStepComplete(profile)).toBe(false);
  });

  it('upserts PUT /supplier/:businessId/profile with businessId in path and body', async () => {
    const calls = stubFetch(200, {
      data: {
        id: 'prof-1',
        businessId: 'biz-1',
        status: 'DRAFT',
        legalName: 'Okechukwu Fashion Ltd',
        contactPhone: '08031234567',
        retailerAccess: 'OPEN',
      },
    });
    const saved = await upsertSupplierProfile('biz-1', {
      legalName: 'Okechukwu Fashion Ltd',
      contactPhone: '08031234567',
      retailerAccess: 'OPEN',
    });
    expect(calls[0]?.url).toBe('/api/v1/supplier/biz-1/profile');
    expect(calls[0]?.method).toBe('PUT');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
      businessId: 'biz-1',
      legalName: 'Okechukwu Fashion Ltd',
      contactPhone: '08031234567',
      retailerAccess: 'OPEN',
    });
    expect(saved.id).toBe('prof-1');
  });

  it('submits POST /supplier/:businessId/profile/submit and marks step 2 complete on PENDING_REVIEW / APPROVED', async () => {
    const calls = stubFetch(200, {
      data: {
        id: 'prof-1',
        businessId: 'biz-1',
        status: 'PENDING_REVIEW',
        submittedAt: '2026-11-05T10:00:00.000Z',
      },
    });
    const submitted = await submitSupplierProfile('biz-1');
    expect(calls[0]?.url).toBe('/api/v1/supplier/biz-1/profile/submit');
    expect(calls[0]?.method).toBe('POST');
    expect(isSupplierProfileStepComplete(submitted)).toBe(true);
    expect(isSupplierProfileStepComplete({ businessId: 'biz-1', status: 'APPROVED' })).toBe(true);
    expect(isSupplierProfileStepComplete({ businessId: 'biz-1', status: 'REJECTED' })).toBe(false);
  });
});
