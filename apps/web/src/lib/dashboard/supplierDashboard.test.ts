import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_SUPPLIER_DASHBOARD,
  httpSupplierDashboardApi,
  supplierDashboardApi,
} from './supplierDashboard';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(String(url));
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return { calls };
}

describe('supplier dashboard API adapter', () => {
  it('selects the real HTTP adapter; no local/mock adapter remains', () => {
    expect(supplierDashboardApi).toBe(httpSupplierDashboardApi);
  });

  it('requests GET /supplier/dashboard with the date range and unwraps data', async () => {
    const payload = { ...EMPTY_SUPPLIER_DASHBOARD, businessName: 'Okechukwu Fashion' };
    const { calls } = stubFetch(200, { data: payload });
    const result = await supplierDashboardApi.getDashboard({
      from: '2026-10-01',
      to: '2026-10-26',
    });
    expect(calls[0]).toContain('/api/v1/supplier/dashboard?from=2026-10-01&to=2026-10-26');
    expect(result).toEqual(payload);
  });

  it('surfaces API failures instead of inventing empty data', async () => {
    stubFetch(500, { error: { code: 'INTERNAL', message: 'boom' } });
    await expect(
      supplierDashboardApi.getDashboard({ from: '2026-10-01', to: '2026-10-26' }),
    ).rejects.toThrow();
  });

  it('keeps the empty shape free of design samples', () => {
    expect(EMPTY_SUPPLIER_DASHBOARD.salesTrend).toEqual([]);
    expect(EMPTY_SUPPLIER_DASHBOARD.stockAlerts).toEqual([]);
    expect(EMPTY_SUPPLIER_DASHBOARD.recentOrders).toEqual([]);
    expect(EMPTY_SUPPLIER_DASHBOARD.setup.completedStepIds).toEqual([]);
  });
});
