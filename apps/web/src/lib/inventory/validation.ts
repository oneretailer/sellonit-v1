import { MAX_ADJUSTMENT_QUANTITY } from './constants';
import type {
  AdjustmentDirection,
  CsvImportRowError,
  CsvImportRowPreview,
  CsvImportValidationResult,
} from './types';

export type StockAdjustmentValidation =
  { valid: true; quantity: number; error: null } | { valid: false; quantity: null; error: string };

export const QUANTITY_NUMERIC_ERROR = 'Enter a numeric quantity.';
export const QUANTITY_MAX_ERROR = `Enter a quantity of ${MAX_ADJUSTMENT_QUANTITY.toLocaleString('en-US')} or less.`;

export function decreaseCapError(availableQuantity: number): string {
  return `You can't remove more than the available stock (${availableQuantity}).`;
}

/**
 * Validates the manual stock adjustment quantity.
 * - Required positive whole number (`1..MAX_ADJUSTMENT_QUANTITY`).
 * - For `decrease`, quantity cannot exceed `availableQuantity` (blocks taking stock below zero).
 */
export function validateStockAdjustment(
  quantityText: string,
  direction: AdjustmentDirection,
  availableQuantity: number,
): StockAdjustmentValidation {
  const trimmed = quantityText.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return { valid: false, quantity: null, error: QUANTITY_NUMERIC_ERROR };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { valid: false, quantity: null, error: QUANTITY_NUMERIC_ERROR };
  }
  if (parsed > MAX_ADJUSTMENT_QUANTITY) {
    return { valid: false, quantity: null, error: QUANTITY_MAX_ERROR };
  }
  if (direction === 'decrease' && parsed > availableQuantity) {
    return { valid: false, quantity: null, error: decreaseCapError(availableQuantity) };
  }
  return { valid: true, quantity: parsed, error: null };
}

export type ProposedChangeCopy = {
  valid: boolean;
  headline: string;
  detail: string;
};

/**
 * Live preview copy for the Adjust Stock dialog's Proposed Change box.
 * - Empty input: "Proposed change: —" / "A quantity is required to continue."
 * - Invalid input: "Proposed change: —" / "Enter a quantity to review your change."
 * - Valid increase/decrease: singular "1 unit" vs plural "N units".
 */
export function formatProposedChange({
  direction,
  quantityText,
  productName,
  availableQuantity,
}: {
  direction: AdjustmentDirection;
  quantityText: string;
  productName: string;
  availableQuantity: number;
}): ProposedChangeCopy {
  if (!quantityText.trim()) {
    return {
      valid: false,
      headline: 'Proposed change: —',
      detail: 'A quantity is required to continue.',
    };
  }
  const validation = validateStockAdjustment(quantityText, direction, availableQuantity);
  if (!validation.valid) {
    return {
      valid: false,
      headline: 'Proposed change: —',
      detail: 'Enter a quantity to review your change.',
    };
  }
  const { quantity } = validation;
  const unitWord = quantity === 1 ? 'unit' : 'units';
  if (direction === 'increase') {
    return {
      valid: true,
      headline: `Proposed change: +${quantity} ${unitWord}`,
      detail: `Increase stock for ${productName} by ${quantity} ${unitWord}. Availability refreshes after the update.`,
    };
  }
  return {
    valid: true,
    headline: `Proposed change: -${quantity} ${unitWord}`,
    detail: `Decrease stock for ${productName} by ${quantity} ${unitWord}. Availability refreshes after the update.`,
  };
}

function stripCellQuotes(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Parses and validates a supplier stock CSV (`sku,quantity` / `sku,available_quantity`).
 * Used by the dev mock adapter and client-side preflight tests.
 */
export function parseInventoryCsv(
  csvText: string,
  knownProductBySku?: ReadonlyMap<string, string>,
): CsvImportValidationResult {
  const rawLines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim());

  const nonEmptyLines = rawLines
    .map((line, index) => ({ line, rowNumber: index + 1 }))
    .filter((entry) => entry.line.length > 0);

  if (nonEmptyLines.length === 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, sku: '—', message: 'The CSV file is empty.' }],
    };
  }

  const firstCells = nonEmptyLines[0]!.line.split(',').map(stripCellQuotes);
  const hasHeader =
    firstCells[0]?.toLowerCase() === 'sku' ||
    firstCells[1]?.toLowerCase().includes('quantity') ||
    firstCells[1]?.toLowerCase().includes('stock');

  const dataLines = hasHeader ? nonEmptyLines.slice(1) : nonEmptyLines;
  if (dataLines.length === 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, sku: '—', message: 'Add at least one SKU row below the header.' }],
    };
  }

  const validRows: CsvImportRowPreview[] = [];
  const errors: CsvImportRowError[] = [];
  const seenSkus = new Set<string>();

  for (const { line, rowNumber } of dataLines) {
    const cells = line.split(',').map(stripCellQuotes);
    const sku = cells[0] ?? '';
    const qtyText = cells[1] ?? '';

    if (!sku) {
      errors.push({ rowNumber, sku: '—', message: 'SKU is required.' });
      continue;
    }

    const normalizedSku = sku.toUpperCase();
    if (seenSkus.has(normalizedSku)) {
      errors.push({ rowNumber, sku, message: 'Duplicate SKU in this CSV file.' });
      continue;
    }
    seenSkus.add(normalizedSku);

    if (knownProductBySku && !knownProductBySku.has(normalizedSku)) {
      errors.push({ rowNumber, sku, message: 'No product matches this SKU.' });
      continue;
    }

    if (!qtyText || !/^\d+$/.test(qtyText)) {
      errors.push({
        rowNumber,
        sku,
        message: 'Quantity must be a whole number (0 or greater).',
      });
      continue;
    }

    const parsedQty = Number.parseInt(qtyText, 10);
    if (!Number.isSafeInteger(parsedQty) || parsedQty < 0 || parsedQty > MAX_ADJUSTMENT_QUANTITY) {
      errors.push({
        rowNumber,
        sku,
        message: `Quantity must be between 0 and ${MAX_ADJUSTMENT_QUANTITY.toLocaleString('en-US')}.`,
      });
      continue;
    }

    validRows.push({
      rowNumber,
      sku,
      productName: knownProductBySku?.get(normalizedSku),
      availableQuantity: parsedQty,
    });
  }

  return { validRows, errors };
}
