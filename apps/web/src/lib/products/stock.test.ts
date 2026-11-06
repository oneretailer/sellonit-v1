import { describe, expect, it } from 'vitest';
import { LOW_STOCK_THRESHOLD } from './constants';
import { stockLevel, stockText } from './stock';

describe('shared stock rule', () => {
  it('zero is out of stock regardless of the flag', () => {
    expect(stockLevel(0)).toBe('out-of-stock');
    expect(stockLevel(0, false)).toBe('out-of-stock');
    expect(stockText(0)).toBe('Out of stock');
  });

  it(`1..${LOW_STOCK_THRESHOLD} is low stock (named assumption)`, () => {
    expect(stockLevel(1)).toBe('low-stock');
    expect(stockLevel(LOW_STOCK_THRESHOLD)).toBe('low-stock');
    expect(stockLevel(LOW_STOCK_THRESHOLD + 1)).toBe('in-stock');
    expect(stockText(4)).toBe('4 left');
    expect(stockText(40)).toBe('40 in stock');
  });

  it('prefers the backend flag over the local threshold', () => {
    expect(stockLevel(500, true)).toBe('low-stock');
    expect(stockLevel(2, false)).toBe('in-stock');
  });
});
