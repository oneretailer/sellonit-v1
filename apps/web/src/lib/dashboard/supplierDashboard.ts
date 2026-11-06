import { apiFetch } from '@/lib/api-client';
import type { AccountRole } from '@/lib/onboarding/roles';
import { SUPPLIER_SETUP_STEPS } from '@/lib/onboarding/supplierSetup';

export type DateRange = { from: string; to: string };

export type SupplierDashboardData = {
  summary: {
    /** Integer kobo. */
    totalSales: number;
    orderCount: number;
    retailerOrderCount: number;
    awaitingFulfilment: number;
    listedProducts: number;
    lowStock: number;
    outOfStock: number;
  };
  salesTrend: { date: string; /** Integer kobo. */ value: number }[];
  stockAlerts: {
    id: string;
    name: string;
    sku: string;
    variant: string;
    quantityLeft: number;
  }[];
  recentOrders: {
    id: string;
    retailerName: string;
    retailerLocation: string;
    itemCount: number;
    orderedAt: string;
    /** Integer kobo. */
    amount: number;
    status: 'awaiting_fulfilment' | 'shipped' | 'delivered';
  }[];
  setup: { completedStepIds: string[] };
  businessName?: string;
};

export type SetupStep = { id: string; label: string };

/**
 * The supplier setup checklist. Re-exported from the single source of truth
 * (lib/onboarding/supplierSetup.ts) so the dashboard widget, the Supplier Setup
 * screen and any modal always agree. Six steps; progress is completed / 6.
 */
export const SETUP_STEPS = SUPPLIER_SETUP_STEPS;

export const EMPTY_SUPPLIER_DASHBOARD: SupplierDashboardData = {
  summary: {
    totalSales: 0,
    orderCount: 0,
    retailerOrderCount: 0,
    awaitingFulfilment: 0,
    listedProducts: 0,
    lowStock: 0,
    outOfStock: 0,
  },
  salesTrend: [],
  stockAlerts: [],
  recentOrders: [],
  // Steps 1 and 2 are resolved from GET /businesses and GET /supplier/:businessId/profile
  // (see useSupplierSetupProgress). TODO(BE-003): return Steps 3–6 in completedStepIds
  // once GET /supplier/dashboard is implemented.
  setup: { completedStepIds: [] },
};

export interface SupplierDashboardApi {
  getDashboard(range: DateRange, businessId?: string | null): Promise<SupplierDashboardData>;
}

/**
 * Real HTTP adapter. TODO(BE-003): GET /supplier/dashboard is not implemented
 * yet on the backend (see docs/backend-handoff.md). Until BE-003 lands, Overview
 * surfaces an honest unavailable banner — never mock data.
 */
export const httpSupplierDashboardApi: SupplierDashboardApi = {
  async getDashboard(range, businessId) {
    const search = new URLSearchParams({ from: range.from, to: range.to });
    if (businessId) search.set('businessId', businessId);
    const response = await apiFetch<{ data: SupplierDashboardData }>(
      `/supplier/dashboard?${search.toString()}`,
      { method: 'GET' },
    );
    return response.data;
  },
};

/** Single switch point; always the real API now that mocks are removed. */
export const supplierDashboardApi: SupplierDashboardApi = httpSupplierDashboardApi;

/** Product onboarding roles are intentionally separate from backend permissions. */
export type SupplierDashboardRole = AccountRole;
