/**
 * Dev-only in-memory review adapter for `/dashboard/inventory`.
 *
 * STRICTLY OFF BY DEFAULT: only active when `NODE_ENV !== 'production'` AND
 * `NEXT_PUBLIC_DEV_MOCK_INVENTORY === '1'`. Never runs in production builds or
 * standard local/CI runs without that explicit opt-in flag.
 */
import { ApiError } from '@/lib/api-client';
import { resolveInventoryStockStatus } from './stock';
import type {
  InventoryItem,
  InventoryListParams,
  InventorySummary,
  Paginated,
  StockAdjustmentInput,
} from './types';

export const SAMPLE_INVENTORY_ITEMS: readonly InventoryItem[] = [
  {
    productId: 'inv-ct-001',
    name: 'Classic cotton tee',
    sku: 'SF-CT-001',
    imageUrl: null,
    availableQuantity: 0,
    reservedQuantity: null,
    stockStatus: 'out-of-stock',
  },
  {
    productId: 'inv-ls-014',
    name: 'Linen shirt',
    sku: 'SF-LS-014',
    imageUrl: null,
    availableQuantity: 3,
    reservedQuantity: null,
    stockStatus: 'low-stock',
  },
  {
    productId: 'inv-sj-008',
    name: 'Straight-leg jeans',
    sku: 'SF-SJ-008',
    imageUrl: null,
    availableQuantity: 5,
    reservedQuantity: null,
    stockStatus: 'low-stock',
  },
  {
    productId: 'inv-rt-021',
    name: 'Ribbed tank top',
    sku: 'SF-RT-021',
    imageUrl: null,
    availableQuantity: 8,
    reservedQuantity: null,
    stockStatus: 'low-stock',
  },
  {
    productId: 'inv-tb-032',
    name: 'Canvas tote bag',
    sku: 'SF-TB-032',
    imageUrl: null,
    availableQuantity: 64,
    reservedQuantity: null,
    stockStatus: 'in-stock',
  },
  {
    productId: 'inv-ht-004',
    name: 'Wide-brim hat',
    sku: 'SF-HT-004',
    imageUrl: null,
    availableQuantity: 120,
    reservedQuantity: null,
    stockStatus: 'in-stock',
  },
] as const;

export function isDevInventoryMockEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NEXT_PUBLIC_DEV_MOCK_INVENTORY === '1';
}

const storeByBusiness = new Map<string, InventoryItem[]>();

function rowsForBusiness(businessId: string | null): InventoryItem[] {
  const key = businessId ?? '__default__';
  let rows = storeByBusiness.get(key);
  if (!rows) {
    rows = SAMPLE_INVENTORY_ITEMS.map((item) => ({ ...item }));
    storeByBusiness.set(key, rows);
  }
  return rows;
}

export const devMockInventory = {
  list(businessId: string | null, params: InventoryListParams): Promise<Paginated<InventoryItem>> {
    const allRows = rowsForBusiness(businessId);
    const query = params.q?.trim().toLowerCase() ?? '';
    const status = params.status ?? 'all';
    const filtered = allRows.filter((row) => {
      if (status === 'low' && row.stockStatus !== 'low-stock') return false;
      if (status === 'out' && row.stockStatus !== 'out-of-stock') return false;
      if (status === 'in' && row.stockStatus !== 'in-stock') return false;
      if (query) {
        const matchesName = row.name.toLowerCase().includes(query);
        const matchesSku = row.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const start = (params.page - 1) * params.pageSize;
    const data = filtered.slice(start, start + params.pageSize).map((item) => ({ ...item }));
    return Promise.resolve({
      data,
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages,
      },
    });
  },

  summary(businessId: string | null): Promise<InventorySummary> {
    const allRows = rowsForBusiness(businessId);
    return Promise.resolve({
      total: allRows.length,
      low: allRows.filter((row) => row.stockStatus === 'low-stock').length,
      out: allRows.filter((row) => row.stockStatus === 'out-of-stock').length,
      inStock: allRows.filter((row) => row.stockStatus === 'in-stock').length,
    });
  },

  adjustStock(
    businessId: string | null,
    productId: string,
    input: StockAdjustmentInput,
  ): Promise<InventoryItem> {
    const allRows = rowsForBusiness(businessId);
    const target = allRows.find((row) => row.productId === productId);
    if (!target) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Product not found.'));
    }
    const delta = input.direction === 'increase' ? input.quantity : -input.quantity;
    const nextAvailable = target.availableQuantity + delta;
    if (nextAvailable < 0) {
      return Promise.reject(
        new ApiError(
          422,
          'INSUFFICIENT_INVENTORY',
          `You can't remove more than the available stock (${target.availableQuantity}).`,
          null,
          {
            quantity: `You can't remove more than the available stock (${target.availableQuantity}).`,
          },
        ),
      );
    }
    target.availableQuantity = nextAvailable;
    target.stockStatus = resolveInventoryStockStatus(nextAvailable);
    return Promise.resolve({ ...target });
  },
};
