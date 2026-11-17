import { describe, expect, it } from 'vitest';
import { MAX_ADJUSTMENT_QUANTITY } from './constants';
import {
  QUANTITY_MAX_ERROR,
  QUANTITY_NUMERIC_ERROR,
  formatProposedChange,
  parseInventoryCsv,
  validateStockAdjustment,
} from './validation';

describe('validateStockAdjustment', () => {
  it('rejects empty, zero, negative, decimal, and non-numeric inputs', () => {
    for (const bad of ['', '   ', '0', '-3', '2.5', '12a', 'abc']) {
      expect(validateStockAdjustment(bad, 'increase', 10)).toEqual({
        valid: false,
        quantity: null,
        error: QUANTITY_NUMERIC_ERROR,
      });
    }
  });

  it('enforces the named maximum quantity constant', () => {
    expect(validateStockAdjustment(String(MAX_ADJUSTMENT_QUANTITY), 'increase', 0)).toEqual({
      valid: true,
      quantity: MAX_ADJUSTMENT_QUANTITY,
      error: null,
    });
    expect(validateStockAdjustment(String(MAX_ADJUSTMENT_QUANTITY + 1), 'increase', 0)).toEqual({
      valid: false,
      quantity: null,
      error: QUANTITY_MAX_ERROR,
    });
  });

  it('caps decreases at current available stock while allowing increases of any valid size', () => {
    expect(validateStockAdjustment('12', 'increase', 3)).toEqual({
      valid: true,
      quantity: 12,
      error: null,
    });
    expect(validateStockAdjustment('3', 'decrease', 3)).toEqual({
      valid: true,
      quantity: 3,
      error: null,
    });
    expect(validateStockAdjustment('4', 'decrease', 3)).toEqual({
      valid: false,
      quantity: null,
      error: "You can't remove more than the available stock (3).",
    });
    expect(validateStockAdjustment('1', 'decrease', 0)).toEqual({
      valid: false,
      quantity: null,
      error: "You can't remove more than the available stock (0).",
    });
  });
});

describe('formatProposedChange', () => {
  it('formats plural and singular increases', () => {
    expect(
      formatProposedChange({
        direction: 'increase',
        quantityText: '12',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: true,
      headline: 'Proposed change: +12 units',
      detail:
        'Increase stock for Linen shirt by 12 units. Availability refreshes after the update.',
    });

    expect(
      formatProposedChange({
        direction: 'increase',
        quantityText: '1',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: true,
      headline: 'Proposed change: +1 unit',
      detail: 'Increase stock for Linen shirt by 1 unit. Availability refreshes after the update.',
    });
  });

  it('formats plural and singular decreases', () => {
    expect(
      formatProposedChange({
        direction: 'decrease',
        quantityText: '2',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: true,
      headline: 'Proposed change: -2 units',
      detail: 'Decrease stock for Linen shirt by 2 units. Availability refreshes after the update.',
    });

    expect(
      formatProposedChange({
        direction: 'decrease',
        quantityText: '1',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: true,
      headline: 'Proposed change: -1 unit',
      detail: 'Decrease stock for Linen shirt by 1 unit. Availability refreshes after the update.',
    });
  });

  it('distinguishes empty quantity from invalid quantity in the proposed change box', () => {
    expect(
      formatProposedChange({
        direction: 'increase',
        quantityText: '',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: false,
      headline: 'Proposed change: —',
      detail: 'A quantity is required to continue.',
    });

    expect(
      formatProposedChange({
        direction: 'decrease',
        quantityText: '5',
        productName: 'Linen shirt',
        availableQuantity: 3,
      }),
    ).toEqual({
      valid: false,
      headline: 'Proposed change: —',
      detail: 'Enter a quantity to review your change.',
    });
  });
});

describe('parseInventoryCsv', () => {
  const known = new Map([
    ['SF-LS-014', 'Linen shirt'],
    ['SF-CT-001', 'Classic cotton tee'],
  ]);

  it('parses valid CSV rows with a header', () => {
    const csv = 'sku,quantity\nSF-LS-014,25\nSF-CT-001,0\n';
    expect(parseInventoryCsv(csv, known)).toEqual({
      validRows: [
        { rowNumber: 2, sku: 'SF-LS-014', productName: 'Linen shirt', availableQuantity: 25 },
        {
          rowNumber: 3,
          sku: 'SF-CT-001',
          productName: 'Classic cotton tee',
          availableQuantity: 0,
        },
      ],
      errors: [],
    });
  });

  it('flags unknown SKUs, duplicate SKUs, and invalid quantities', () => {
    const csv = [
      'sku,available_quantity',
      'SF-LS-014,10',
      'SF-LS-014,20',
      'SF-UNKNOWN,5',
      'SF-CT-001,abc',
    ].join('\n');
    const result = parseInventoryCsv(csv, known);
    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toEqual([
      { rowNumber: 3, sku: 'SF-LS-014', message: 'Duplicate SKU in this CSV file.' },
      { rowNumber: 4, sku: 'SF-UNKNOWN', message: 'No product matches this SKU.' },
      {
        rowNumber: 5,
        sku: 'SF-CT-001',
        message: 'Quantity must be a whole number (0 or greater).',
      },
    ]);
  });
});
