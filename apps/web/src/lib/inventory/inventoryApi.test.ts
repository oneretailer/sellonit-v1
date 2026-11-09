/** @vitest-environment jsdom */

import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDPOINT_NOT_IMPLEMENTED_CODE } from '@/lib/api-client';
import { setActiveBusinessId } from '@/lib/business/activeBusiness';
import { productKeys } from '@/lib/products/queries';
import {
  inventoryApi,
  normalizeInventoryItem,
  normalizeInventorySummary,
} from './inventoryApi';
import { invalidateInventoryAndProducts, inventoryKeys } from './queries';

beforeEach(() => {
  localStorage.clear();
  setActiveBusinessId('biz-supplier-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inventoryApi contract & cache invalidation', () => {
  it('never coerces null or missing reservedQuantity to 0, while preserving explicit 0', () => {
    const missingReserved = normalizeInventoryItem({
      productId: 'p-1',
      name: 'Linen shirt',
      sku: 'SF-LS-014',
      availableQuantity: 3,
    });
    expect(missingReserved.reservedQuantity).toBeNull();
    expect(missingReserved.stockStatus).toBe('low-stock');

    const nullReserved = normalizeInventoryItem({
      productId: 'p-2',
      name: 'Classic cotton tee',
      sku: 'SF-CT-001',
      availableQuantity: 0,
      reservedQuantity: null,
    });
    expect(nullReserved.reservedQuantity).toBeNull();
    expect(nullReserved.stockStatus).toBe('out-of-stock');

    const zeroReserved = normalizeInventoryItem({
      productId: 'p-3',
      name: 'Canvas tote bag',
      sku: 'SF-TB-032',
      availableQuantity: 64,
      reservedQuantity: 0,
    });
    expect(zeroReserved.reservedQuantity).toBe(0);
    expect(zeroReserved.stockStatus).toBe('in-stock');
  });

  it('normalizes summary payloads and derives inStock when omitted', () => {
    expect(normalizeInventorySummary({ total: 124, low: 3, out: 1 })).toEqual({
      total: 124,
      low: 3,
      out: 1,
      inStock: 120,
    });
  });

  it('sends filter & businessId query params on list and delta + Idempotency-Key on adjustStock', async () => {
    const calls: { url: string; method: string; headers: Headers; body: unknown }[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      calls.push({ url: String(url), method: init?.method ?? 'GET', headers, body });
      if ((init?.method ?? 'GET') === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                productId: 'inv-ls-014',
                name: 'Linen shirt',
                sku: 'SF-LS-014',
                imageUrl: null,
                availableQuantity: 15,
                reservedQuantity: null,
                stockStatus: 'in-stock',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [],
            meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    await inventoryApi.list({ page: 1, pageSize: 10, q: 'linen', status: 'low' });
    expect(calls[0]?.url).toContain('/api/v1/supplier/inventory?');
    expect(calls[0]?.url).toContain('status=low');
    expect(calls[0]?.url).toContain('q=linen');
    expect(calls[0]?.url).toContain('businessId=biz-supplier-1');
    expect(calls[0]?.headers.get('X-Business-Id')).toBe('biz-supplier-1');

    const updated = await inventoryApi.adjustStock(
      'inv-ls-014',
      { direction: 'increase', quantity: 12 },
      { idempotencyKey: 'idem-123' },
    );
    expect(calls[1]?.url).toBe('/api/v1/supplier/inventory/inv-ls-014/adjustments');
    expect(calls[1]?.method).toBe('POST');
    expect(calls[1]?.headers.get('Idempotency-Key')).toBe('idem-123');
    expect(calls[1]?.body).toEqual({
      businessId: 'biz-supplier-1',
      direction: 'increase',
      quantity: 12,
    });
    expect(updated.availableQuantity).toBe(15);
    expect(updated.reservedQuantity).toBeNull();
  });

  it('surfaces ENDPOINT_NOT_IMPLEMENTED when /supplier/inventory is unmounted on Express', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('<!DOCTYPE html><pre>Cannot GET /api/v1/supplier/inventory</pre>', {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    );
    await expect(inventoryApi.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      status: 404,
      code: ENDPOINT_NOT_IMPLEMENTED_CODE,
    });
  });

  it('invalidates inventory list + summary AND products list + summary after adjustment', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidateInventoryAndProducts(queryClient, 'biz-supplier-1');

    expect(spy).toHaveBeenCalledWith({ queryKey: inventoryKeys.all('biz-supplier-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: inventoryKeys.summary('biz-supplier-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: productKeys.all('biz-supplier-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: productKeys.summary('biz-supplier-1') });
  });
});
