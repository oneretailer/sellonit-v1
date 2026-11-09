import { MAX_ADJUSTMENT_QUANTITY } from './constants';
import type { AdjustmentDirection } from './types';

export type StockAdjustmentValidation =
  | { valid: true; quantity: number; error: null }
  | { valid: false; quantity: null; error: string };

export const QUANTITY_NUMERIC_ERROR = 'Enter a numeric quantity.';
export const QUANTITY_MAX_ERROR = `Enter a quantity of ${MAX_ADJUSTMENT_QUANTITY.toLocaleString('en-US')} or less.`;

export function decreaseCapError(availableQuantity: number): string {
  return `You can't remove more than the available stock (${availableQuantity}).`;
}

/**
 * Validates the manual stock adjustment quantity.
 * - Required positive whole number (`1..MAX_ADJUSTMENT_QUANTITY`).
 * - ASSUMPTION: For `decrease`, quantity cannot exceed `availableQuantity`
 *   (backend validation rule takes precedence if/when it differs).
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
 * Uses singular "1 unit" vs plural "N units" and a true minus sign (`−`, U+2212)
 * for decreases.
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
    headline: `Proposed change: −${quantity} ${unitWord}`,
    detail: `Decrease stock for ${productName} by ${quantity} ${unitWord}. Availability refreshes after the update.`,
  };
}
