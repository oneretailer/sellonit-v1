/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from './server';
import { resetMockData } from './handlers';
import { DEFAULT_MOCK_CONFIG, writeMockConfig, type MockPersona } from './scenarios';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { createProduct, getProduct, listProducts, publishProduct, setPricingRule } from '@/lib/workspace/productApi';
import { listSuppliers, transitionSupplier } from '@/lib/workspace/adminApi';
import { getSessionContext } from '@/lib/workspace/api';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => { resetMockData(); writeMockConfig(DEFAULT_MOCK_CONFIG); });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const filters = { status: 'PENDING_REVIEW' as const, page: 1, pageSize: 10 };
const body = { name: 'Test shirt', category: 'Clothing', defaultVariant: { sku: 'TEST-1', basePriceKobo: 29 } };
const id = '33333333-3333-4333-8333-333333333331';
describe('MSW permission matrix (server grants, not client role inference)', () => {
  it.each([['OWNER', true, true, true], ['MANAGER', true, false, true], ['STAFF', false, false, false]] as [MockPersona, boolean, boolean, boolean][])('%s grants write/pricing/publish %s/%s/%s', async (persona, write, pricing, publish) => {
    writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona }); const context = await getSessionContext();
    expect(context.permissions.includes('product:write')).toBe(write); expect(context.permissions.includes('pricing:set')).toBe(pricing); expect(context.permissions.includes('product:publish')).toBe(publish);
    if (!write) await expect(createProduct(body, crypto.randomUUID())).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    if (!pricing) await expect(setPricingRule(id, 0)).rejects.toMatchObject({ status: 403 });
    if (!publish) await expect(publishProduct(id, 'publish')).rejects.toMatchObject({ status: 403 });
  });
  it('only platform ADMIN can review suppliers', async () => {
    await expect(listSuppliers(filters)).rejects.toMatchObject({ status: 403 });
    writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona: 'ADMIN' });
    expect((await listSuppliers(filters)).data).toHaveLength(1);
    expect((await transitionSupplier('44444444-4444-4444-8444-444444444440', 'approve', { plan: 'ENTERPRISE_PLUS' })).plan).toBe('ENTERPRISE_PLUS');
    await expect(transitionSupplier('44444444-4444-4444-8444-444444444440', 'approve', {})).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});
describe('MSW response scenarios', () => {
  it.each(['401', '403', '404', '409', '422'] as const)('normalizes %s into ApiError', async (scenario) => {
    writeMockConfig({ ...DEFAULT_MOCK_CONFIG, scenario });
    await expect(listProducts({ search: '', page: 1, pageSize: 10 })).rejects.toBeInstanceOf(ApiError);
    try { await getProduct(id); } catch (error) { expect(error).toMatchObject({ status: Number(scenario), ...(scenario === '422' ? { fields: { 'defaultVariant.sku': 'Use a different SKU.' } } : {}) }); }
  });
  it('returns an actual empty page', async () => { writeMockConfig({ ...DEFAULT_MOCK_CONFIG, scenario: 'empty' }); expect(await listProducts({ search: '', page: 1, pageSize: 10 })).toMatchObject({ data: [], meta: { total: 0 } }); });
  it('delays the slow scenario', async () => { writeMockConfig({ ...DEFAULT_MOCK_CONFIG, scenario: 'slow' }); const start = performance.now(); await getSessionContext(); expect(performance.now() - start).toBeGreaterThanOrEqual(1700); });
});
describe('MSW product lifecycle', () => {
  it('creates, edits, prices, publishes and unpublishes without stock', async () => {
    const created = await createProduct(body, crypto.randomUUID()); expect(created.defaultVariant.basePriceKobo).toBe(29);
    await expect(createProduct(body, crypto.randomUUID())).rejects.toMatchObject({ code: 'DUPLICATE_SKU', fields: { 'defaultVariant.sku': expect.any(String) } });
    expect((await setPricingRule(created.id, 0)).pricingRule.maxMarkupKobo).toBe(0);
    expect((await publishProduct(created.id, 'publish')).status).toBe('PUBLISHED');
    expect((await publishProduct(created.id, 'unpublish')).status).toBe('UNPUBLISHED');
  });
  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as const)('rejects publishing when supplier is %s', async (supplierStatus) => { writeMockConfig({ ...DEFAULT_MOCK_CONFIG, supplierStatus }); await expect(publishProduct(id, 'publish')).rejects.toMatchObject({ code: 'SUPPLIER_NOT_APPROVED' }); });
  it('keeps archived products immutable', async () => { const archived = '33333333-3333-4333-8333-333333333333'; await expect(api.PATCH('/supplier/products/{id}', { params: { path: { id: archived } }, body: { name: 'No' } })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' }); });
  it('requires a decision reason', async () => { writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona: 'ADMIN' }); await expect(transitionSupplier('44444444-4444-4444-8444-444444444440', 'reject', { reason: ' ' })).rejects.toMatchObject({ status: 422, fields: { reason: expect.any(String) } }); });
});
