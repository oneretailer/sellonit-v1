import { stockLevel, type StockLevel } from '@/lib/products/stock';

/**
 * Resolves an inventory row's stock status using a backend-provided status or
 * `lowStock` flag when supplied, falling back to the shared `stockLevel` rule
 * (`0` = out-of-stock, `1..LOW_STOCK_THRESHOLD` = low-stock, `> 10` = in-stock).
 */
export function resolveInventoryStockStatus(
  availableQuantity: number,
  backendStatus?: string | null,
  lowStockFlag?: boolean,
): StockLevel {
  if (typeof backendStatus === 'string' && backendStatus.trim().length > 0) {
    const normalized = backendStatus.trim().toLowerCase().replaceAll('_', '-');
    if (normalized === 'out' || normalized === 'out-of-stock') return 'out-of-stock';
    if (normalized === 'low' || normalized === 'low-stock') return 'low-stock';
    if (normalized === 'in' || normalized === 'in-stock') return 'in-stock';
  }
  return stockLevel(availableQuantity, lowStockFlag);
}

export function stockStatusLabel(level: StockLevel): 'Out of stock' | 'Low stock' | 'In stock' {
  switch (level) {
    case 'out-of-stock':
      return 'Out of stock';
    case 'low-stock':
      return 'Low stock';
    case 'in-stock':
      return 'In stock';
  }
}
