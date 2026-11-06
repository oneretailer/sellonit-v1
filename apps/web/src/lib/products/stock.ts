import { LOW_STOCK_THRESHOLD } from './constants';

export type StockLevel = 'out-of-stock' | 'low-stock' | 'in-stock';

/**
 * One shared stock-status rule. A backend-provided `lowStock` flag wins when
 * present; otherwise 0 is out of stock and 1..LOW_STOCK_THRESHOLD is low.
 */
export function stockLevel(quantity: number, lowStockFlag?: boolean): StockLevel {
  if (quantity <= 0) return 'out-of-stock';
  if (lowStockFlag === true) return 'low-stock';
  if (lowStockFlag === false) return 'in-stock';
  return quantity <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock';
}

export function stockText(quantity: number, lowStockFlag?: boolean): string {
  const level = stockLevel(quantity, lowStockFlag);
  if (level === 'out-of-stock') return 'Out of stock';
  if (level === 'low-stock') return `${quantity} left`;
  return `${quantity} in stock`;
}
