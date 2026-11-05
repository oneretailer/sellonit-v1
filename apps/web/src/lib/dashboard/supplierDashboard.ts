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
  // No step is reported complete by the backend yet. "Business information" is
  // derived locally from the Create Business draft (see useSupplierSetupProgress).
  // TODO(backend): return real completedStepIds once the dashboard endpoint exists.
  setup: { completedStepIds: [] },
};

export interface SupplierDashboardApi {
  getDashboard(range: DateRange): Promise<SupplierDashboardData>;
}

/**
 * Real HTTP adapter. TODO(backend): GET /supplier/dashboard is not implemented
 * yet (the OpenAPI document only sketches per-business analytics). Until it
 * exists the Overview shows its load-error + Retry state — no mock data.
 * Expected response: `{ data: SupplierDashboardData }` with money in kobo and
 * `setup.completedStepIds` from the shared six-step checklist.
 */
export const httpSupplierDashboardApi: SupplierDashboardApi = {
  async getDashboard(range) {
    const search = new URLSearchParams({ from: range.from, to: range.to });
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
