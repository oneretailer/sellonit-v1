import { describe, expect, it } from 'vitest';
import {
  EMPTY_SUPPLIER_DASHBOARD,
  httpSupplierDashboardApi,
  localSupplierDashboardApi,
  supplierDashboardApi,
} from './supplierDashboard';

describe('supplier dashboard API adapters', () => {
  it('selects the local adapter in exactly one exported switch point', () => {
    expect(supplierDashboardApi).toBe(localSupplierDashboardApi);
  });

  it('returns only empty summaries and lists, with account as the sole completed setup step', async () => {
    const result = await localSupplierDashboardApi.getDashboard({
      from: '2026-10-01',
      to: '2026-10-26',
    });
    expect(result).toEqual(EMPTY_SUPPLIER_DASHBOARD);
    expect(result.summary).toEqual({
      totalSales: 0,
      orderCount: 0,
      retailerOrderCount: 0,
      awaitingFulfilment: 0,
      listedProducts: 0,
      lowStock: 0,
      outOfStock: 0,
    });
    expect(result.salesTrend).toEqual([]);
    expect(result.stockAlerts).toEqual([]);
    expect(result.recentOrders).toEqual([]);
    expect(result.setup.completedStepIds).toEqual(['account']);
  });

  it('keeps the future HTTP adapter inactive until a complete backend contract is implemented', async () => {
    await expect(
      httpSupplierDashboardApi.getDashboard({ from: '2026-10-01', to: '2026-10-26' }),
    ).rejects.toThrow('TODO(backend): supplier dashboard endpoint is not implemented.');
  });
});
