import { describe, expect, it } from 'vitest';
import { resolveInventoryStockStatus, stockStatusLabel } from './stock';

describe('inventory stock status mapping', () => {
  it('maps 0 to out-of-stock, 1..10 to low-stock, and >10 to in-stock', () => {
    expect(resolveInventoryStockStatus(0)).toBe('out-of-stock');
    expect(resolveInventoryStockStatus(1)).toBe('low-stock');
    expect(resolveInventoryStockStatus(3)).toBe('low-stock');
    expect(resolveInventoryStockStatus(10)).toBe('low-stock');
    expect(resolveInventoryStockStatus(11)).toBe('in-stock');
    expect(resolveInventoryStockStatus(120)).toBe('in-stock');
  });

  it('prefers an explicit backend stockStatus or lowStock flag when present', () => {
    expect(resolveInventoryStockStatus(25, 'low')).toBe('low-stock');
    expect(resolveInventoryStockStatus(25, 'OUT_OF_STOCK')).toBe('out-of-stock');
    expect(resolveInventoryStockStatus(5, 'in-stock')).toBe('in-stock');
    expect(resolveInventoryStockStatus(25, null, true)).toBe('low-stock');
    expect(resolveInventoryStockStatus(5, undefined, false)).toBe('in-stock');
  });

  it('formats human-readable pill labels', () => {
    expect(stockStatusLabel('out-of-stock')).toBe('Out of stock');
    expect(stockStatusLabel('low-stock')).toBe('Low stock');
    expect(stockStatusLabel('in-stock')).toBe('In stock');
  });
});
