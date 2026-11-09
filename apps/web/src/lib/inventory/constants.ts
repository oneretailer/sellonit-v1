/**
 * Inventory module constants.
 * Reuses the shared Products constants (`LOW_STOCK_THRESHOLD`, `PRODUCTS_PAGE_SIZE`,
 * `SEARCH_DEBOUNCE_MS`) so stock thresholds, pagination, and search debounce never drift.
 */
import {
  LOW_STOCK_THRESHOLD,
  PRODUCTS_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
} from '@/lib/products/constants';

export { LOW_STOCK_THRESHOLD, PRODUCTS_PAGE_SIZE, SEARCH_DEBOUNCE_MS };

/** Maximum whole-unit quantity allowed in a single manual stock adjustment. */
export const MAX_ADJUSTMENT_QUANTITY = 1_000_000;

export const INVENTORY_ROUTES = {
  list: '/dashboard/inventory',
  lowStock: '/dashboard/inventory?tab=low-stock',
  outOfStock: '/dashboard/inventory?tab=out-of-stock',
} as const;
