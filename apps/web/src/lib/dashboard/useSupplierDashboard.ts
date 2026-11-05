'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { BusinessContext } from '@/lib/business/BusinessContext';
import type { DateRange, SupplierDashboardData } from './supplierDashboard';
import { EMPTY_SUPPLIER_DASHBOARD, supplierDashboardApi } from './supplierDashboard';

type DashboardState = {
  requestId: string | null;
  data: SupplierDashboardData;
  status: 'success' | 'error' | 'unavailable';
};

export function useSupplierDashboard(range: DateRange) {
  const businessContext = useContext(BusinessContext);
  const businessId = businessContext?.activeBusiness?.id ?? null;
  const [retryKey, setRetryKey] = useState(0);
  const { from, to } = range;
  const requestId = `${businessId ?? ''}|${from}|${to}|${retryKey}`;
  const [state, setState] = useState<DashboardState>({
    requestId: null,
    data: EMPTY_SUPPLIER_DASHBOARD,
    status: 'error',
  });

  useEffect(() => {
    let active = true;
    const call = businessId
      ? supplierDashboardApi.getDashboard({ from, to }, businessId)
      : supplierDashboardApi.getDashboard({ from, to });
    void call
      .then((data) => {
        if (active) setState({ requestId, data, status: 'success' });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setState({
          requestId,
          data: EMPTY_SUPPLIER_DASHBOARD,
          status: isEndpointNotImplemented(caught) ? 'unavailable' : 'error',
        });
      });
    return () => {
      active = false;
    };
  }, [businessId, from, requestId, to]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  const isCurrent = state.requestId === requestId;
  return {
    data: isCurrent && state.status === 'success' ? state.data : EMPTY_SUPPLIER_DASHBOARD,
    isLoading: !isCurrent,
    error: isCurrent && state.status === 'error',
    unavailable: isCurrent && state.status === 'unavailable',
    retry,
  };
}
