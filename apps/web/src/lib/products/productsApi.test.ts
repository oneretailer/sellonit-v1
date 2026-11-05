/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveBusinessId } from '@/lib/business/activeBusiness';
import { ENDPOINT_NOT_IMPLEMENTED_CODE } from '@/lib/api-client';
import { productsApi } from './productsApi';

beforeEach(() => {
  localStorage.clear();
  setActiveBusinessId('biz-supplier-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('productsApi contract adapter', () => {
  it('propagates active businessId in list query and normalizes uppercase product status', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(String(url));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'prod-1',
                name: 'Linen Shirt',
                description: 'Breathable',
                category: 'tops',
                sku: 'LIN-001',
                wholesalePrice: 450000,
                stockQuantity: 10,
                status: 'PUBLISHED',
                images: [],
                createdAt: '2026-11-05T10:00:00.000Z',
                updatedAt: '2026-11-05T10:00:00.000Z',
              },
            ],
            meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const result = await productsApi.list({ page: 1, pageSize: 10, q: 'linen' });
    expect(urls[0]).toContain('businessId=biz-supplier-1');
    expect(urls[0]).toContain('q=linen');
    expect(result.data[0]?.status).toBe('published');
  });

  it('surfaces ENDPOINT_NOT_IMPLEMENTED when /supplier/products is not mounted on Express', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('<!DOCTYPE html><pre>Cannot GET /api/v1/supplier/products</pre>', {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    );
    await expect(productsApi.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      status: 404,
      code: ENDPOINT_NOT_IMPLEMENTED_CODE,
    });
  });
});
