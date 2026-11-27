/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_BUSINESS_HEADER, setActiveBusinessId } from '@/lib/business/activeBusiness';
import { ENDPOINT_NOT_IMPLEMENTED_CODE } from '@/lib/api-client';
import { LIVE_CATALOGUE_CAPABILITIES, productsApi } from './productsApi';

beforeEach(() => {
  localStorage.clear();
  setActiveBusinessId('biz-supplier-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('productsApi contract adapter (PR #18 WorkspaceProduct)', () => {
  it('exposes strict live catalogue capabilities by default', () => {
    expect(productsApi.getCapabilities()).toEqual(LIVE_CATALOGUE_CAPABILITIES);
  });

  it('sends X-Business-Id header + search query param and normalizes WorkspaceProduct responses', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'prod-1',
                businessId: 'biz-supplier-1',
                name: 'Linen Shirt',
                description: 'Breathable',
                category: 'Tops',
                defaultVariant: {
                  sku: 'LIN-001',
                  basePriceKobo: 450000,
                },
                status: 'PUBLISHED',
                pricingRule: { maxMarkupKobo: null },
                publishedAt: '2026-11-12T10:00:00.000Z',
                createdAt: '2026-11-05T10:00:00.000Z',
                updatedAt: '2026-11-12T10:00:00.000Z',
              },
              {
                id: 'prod-2',
                businessId: 'biz-supplier-1',
                name: 'Retired Jacket',
                description: '',
                category: 'Outerwear',
                defaultVariant: {
                  sku: 'JKT-009',
                  basePriceKobo: 1200000,
                },
                status: 'ARCHIVED',
                pricingRule: { maxMarkupKobo: 300000 },
                publishedAt: null,
                createdAt: '2026-11-05T10:00:00.000Z',
                updatedAt: '2026-11-12T10:00:00.000Z',
              },
            ],
            meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const result = await productsApi.list({ page: 1, pageSize: 10, q: 'linen' });
    expect(calls[0]?.url).toBe('/api/v1/supplier/products?page=1&pageSize=10&search=linen');
    expect(calls[0]?.headers.get(ACTIVE_BUSINESS_HEADER)).toBe('biz-supplier-1');
    expect(result.data[0]).toMatchObject({
      id: 'prod-1',
      sku: 'LIN-001',
      wholesalePrice: 450000,
      stockQuantity: null,
      status: 'published',
      pricingRule: { maxMarkupKobo: null },
    });
    expect(result.data[1]).toMatchObject({
      id: 'prod-2',
      status: 'archived',
      pricingRule: { maxMarkupKobo: 300000 },
    });
  });

  it('serializes CreateWorkspaceProductRequest, UpdateWorkspaceProductRequest, pricing-rule, and publish bodies', async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const workspaceProduct = {
      id: 'prod-99',
      businessId: 'biz-supplier-1',
      name: 'Cotton Polo',
      description: 'Pique cotton',
      category: 'Apparel',
      defaultVariant: { sku: 'POLO-01', basePriceKobo: 750000 },
      status: 'DRAFT',
      pricingRule: { maxMarkupKobo: null },
      publishedAt: null,
      createdAt: '2026-11-15T10:00:00.000Z',
      updatedAt: '2026-11-15T10:00:00.000Z',
    };

    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      requests.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });
      return Promise.resolve(
        new Response(JSON.stringify({ data: workspaceProduct }), {
          status: init?.method === 'POST' && String(url).endsWith('/products') ? 201 : 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    await productsApi.create({
      name: 'Cotton Polo',
      description: 'Pique cotton',
      category: 'Apparel',
      sku: 'POLO-01',
      wholesalePrice: 750000,
      stockQuantity: 0,
      imageIds: [],
    });
    expect(requests[0]).toEqual({
      url: '/api/v1/supplier/products',
      method: 'POST',
      body: {
        businessId: 'biz-supplier-1',
        name: 'Cotton Polo',
        description: 'Pique cotton',
        category: 'Apparel',
        defaultVariant: { sku: 'POLO-01', basePriceKobo: 750000 },
      },
    });

    await productsApi.update('prod-99', {
      name: 'Cotton Polo Updated',
      sku: 'POLO-01',
      wholesalePrice: 800000,
    });
    expect(requests[1]).toEqual({
      url: '/api/v1/supplier/products/prod-99',
      method: 'PATCH',
      body: {
        businessId: 'biz-supplier-1',
        name: 'Cotton Polo Updated',
        defaultVariant: { sku: 'POLO-01', basePriceKobo: 800000 },
      },
    });

    await productsApi.updatePricingRule('prod-99', null);
    expect(requests[2]).toEqual({
      url: '/api/v1/supplier/products/prod-99/pricing-rule',
      method: 'PUT',
      body: {
        businessId: 'biz-supplier-1',
        maxMarkupKobo: null,
      },
    });

    await productsApi.publish('prod-99');
    expect(requests[3]).toEqual({
      url: '/api/v1/supplier/products/prod-99/publish',
      method: 'POST',
      body: { businessId: 'biz-supplier-1' },
    });
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
