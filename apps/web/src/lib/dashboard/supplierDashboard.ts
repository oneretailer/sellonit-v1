import type { AccountRole } from '@/lib/onboarding/roles';

export type DateRange = { from: string; to: string };

export type SupplierDashboardData = {
  summary: {
    totalSales: number;
    orderCount: number;
    retailerOrderCount: number;
    awaitingFulfilment: number;
    listedProducts: number;
    lowStock: number;
    outOfStock: number;
  };
  salesTrend: { date: string; value: number }[];
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
    amount: number;
    status: 'awaiting_fulfilment' | 'shipped' | 'delivered';
  }[];
  setup: { completedStepIds: string[] };
  businessName?: string;
};

export type SetupStep = { id: string; label: string };

export const SETUP_STEPS = [
  { id: 'account', label: 'Account created' },
  { id: 'business-profile', label: 'Business profile' },
  { id: 'payout-details', label: 'Payout details' },
  { id: 'first-product', label: 'First product' },
  { id: 'verification', label: 'Verification' },
] as const satisfies readonly SetupStep[];

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
  setup: { completedStepIds: ['account'] },
};

export interface SupplierDashboardApi {
  getDashboard(range: DateRange): Promise<SupplierDashboardData>;
}

export const localSupplierDashboardApi: SupplierDashboardApi = {
  getDashboard(_range) {
    return Promise.resolve({
      ...EMPTY_SUPPLIER_DASHBOARD,
      summary: { ...EMPTY_SUPPLIER_DASHBOARD.summary },
      salesTrend: [],
      stockAlerts: [],
      recentOrders: [],
      setup: { completedStepIds: ['account'] },
    });
  },
};

/**
 * TODO(backend): the current API source has no implemented supplier dashboard
 * handler. The OpenAPI document only sketches summary analytics and requires a
 * business ID; do not call it until the complete contract is implemented.
 */
export const httpSupplierDashboardApi: SupplierDashboardApi = {
  getDashboard(_range) {
    return Promise.reject(
      new Error('TODO(backend): supplier dashboard endpoint is not implemented.'),
    );
  },
};

// Single switch point when a complete, implemented backend contract is available.
export const supplierDashboardApi: SupplierDashboardApi = localSupplierDashboardApi;

/** Product onboarding roles are intentionally separate from backend permissions. */
export type SupplierDashboardRole = AccountRole;
