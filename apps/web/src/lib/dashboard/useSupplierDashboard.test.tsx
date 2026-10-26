/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { SupplierDashboardData } from './supplierDashboard';
import { EMPTY_SUPPLIER_DASHBOARD } from './supplierDashboard';
import { useSupplierDashboard } from './useSupplierDashboard';

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));
vi.mock('./supplierDashboard', async () => {
  const actual = await vi.importActual('./supplierDashboard');
  return { ...actual, supplierDashboardApi: { getDashboard: mocks.getDashboard } };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useSupplierDashboard', () => {
  it('loads the supplied range and exposes the returned data', async () => {
    const data: SupplierDashboardData = {
      ...EMPTY_SUPPLIER_DASHBOARD,
      summary: { ...EMPTY_SUPPLIER_DASHBOARD.summary, orderCount: 3 },
    };
    mocks.getDashboard.mockResolvedValue(data);
    const { result } = renderHook(() =>
      useSupplierDashboard({ from: '2026-10-01', to: '2026-10-26' }),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data.summary.orderCount).toBe(0);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getDashboard).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-26' });
    expect(result.current.data.summary.orderCount).toBe(3);
    expect(result.current.error).toBe(false);
  });

  it('exposes errors and retries without changing the range', async () => {
    mocks.getDashboard
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(EMPTY_SUPPLIER_DASHBOARD);
    const { result } = renderHook(() =>
      useSupplierDashboard({ from: '2026-10-01', to: '2026-10-26' }),
    );
    await waitFor(() => expect(result.current.error).toBe(true));
    result.current.retry();
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(mocks.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('requests updated data when the selected date range changes', async () => {
    mocks.getDashboard.mockResolvedValue(EMPTY_SUPPLIER_DASHBOARD);
    const { rerender } = renderHook(
      ({ from }: { from: string }) => useSupplierDashboard({ from, to: '2026-10-26' }),
      {
        initialProps: { from: '2026-10-01' },
      },
    );
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(1));
    rerender({ from: '2026-10-20' });
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
    expect(mocks.getDashboard).toHaveBeenLastCalledWith({ from: '2026-10-20', to: '2026-10-26' });
  });
});
