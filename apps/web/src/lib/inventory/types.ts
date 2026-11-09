import type { StockLevel } from '@/lib/products/stock';
import type { Paginated } from '@/lib/products/types';

export type { Paginated, StockLevel };

/** API query parameter values for `GET /supplier/inventory?status=...`. */
export type InventoryStatusParam = 'all' | 'low' | 'out' | 'in';

/** URL tab values for `/dashboard/inventory?tab=...`. */
export type InventoryTab = 'all' | 'low-stock' | 'out-of-stock' | 'in-stock';

export type AdjustmentDirection = 'increase' | 'decrease';

export type InventoryItem = {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  availableQuantity: number;
  /**
   * System-managed reserved units.
   * `null` means unavailable from the backend — NEVER coerce `null` to `0`.
   */
  reservedQuantity: number | null;
  stockStatus: StockLevel;
  lowStock?: boolean;
};

export type InventorySummary = {
  total: number;
  low: number;
  out: number;
  inStock: number;
};

export type InventoryListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: InventoryStatusParam;
};

export type StockAdjustmentInput = {
  direction: AdjustmentDirection;
  quantity: number;
  reason?: string;
};
