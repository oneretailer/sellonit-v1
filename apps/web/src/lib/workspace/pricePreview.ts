import { assertKobo, formatNaira, MAX_KOBO } from '@/lib/money';

export type PricePreview = { minimumKobo: number; maximumKobo: number | null; label: string };

/** Pure, exact integer arithmetic; no floating-point price calculations. */
export function pricePreview(basePriceKobo: number, maxMarkupKobo: number | null): PricePreview {
  assertKobo(basePriceKobo);
  if (maxMarkupKobo !== null) assertKobo(maxMarkupKobo, true);
  const minimumKobo = basePriceKobo;
  if (maxMarkupKobo === null) return { minimumKobo, maximumKobo: null, label: `Retailers can sell for ${formatNaira(minimumKobo)} or more. No maximum markup.` };
  const maximumKobo = basePriceKobo + maxMarkupKobo;
  if (!Number.isSafeInteger(maximumKobo) || maximumKobo > MAX_KOBO) throw new RangeError('Base price plus markup is too large.');
  return {
    minimumKobo,
    maximumKobo,
    label: maxMarkupKobo === 0
      ? `Retailers must sell at exactly ${formatNaira(minimumKobo)}.`
      : `Retailers can sell from ${formatNaira(minimumKobo)} to ${formatNaira(maximumKobo)}.`,
  };
}
