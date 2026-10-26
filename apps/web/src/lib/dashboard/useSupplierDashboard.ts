'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DateRange, SupplierDashboardData } from './supplierDashboard';
import { EMPTY_SUPPLIER_DASHBOARD, supplierDashboardApi } from './supplierDashboard';

type DashboardState = {
  requestId: string | null;
  data: SupplierDashboardData;
  status: 'success' | 'error';
};

export function useSupplierDashboard(range: DateRange) {
  const [retryKey, setRetryKey] = useState(0);
  const { from, to } = range;
  const requestId = `${from}|${to}|${retryKey}`;
  const [state, setState] = useState<DashboardState>({
    requestId: null,
    data: EMPTY_SUPPLIER_DASHBOARD,
    status: 'error',
  });

  useEffect(() => {
    let active = true;
    void supplierDashboardApi
      .getDashboard({ from, to })
      .then((data) => {
        if (active) setState({ requestId, data, status: 'success' });
      })
      .catch(() => {
        if (active) setState({ requestId, data: EMPTY_SUPPLIER_DASHBOARD, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [from, requestId, to]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  const isCurrent = state.requestId === requestId;
  return {
    data: isCurrent && state.status === 'success' ? state.data : EMPTY_SUPPLIER_DASHBOARD,
    isLoading: !isCurrent,
    error: isCurrent && state.status === 'error',
    retry,
  };
}
