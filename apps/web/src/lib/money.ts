/** Money crosses state/API boundaries only as safe, integer kobo. */
export const MAX_KOBO = Number.MAX_SAFE_INTEGER;

export function assertKobo(value: number, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new RangeError(allowZero ? 'Enter zero or a positive whole-kobo amount.' : 'Enter an amount greater than zero.');
  }
}

/** Parse decimal text exactly: never multiply a floating-point naira value. */
export function nairaToKobo(text: string): number {
  const normalized = text.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new RangeError('Enter a naira amount with at most two decimal places.');
  }
  const [whole = '', fraction = ''] = normalized.replaceAll(',', '').split('.');
  const kobo = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (kobo > BigInt(MAX_KOBO)) throw new RangeError('This amount is too large.');
  return Number(kobo);
}

export function koboToNaira(kobo: number): string {
  assertKobo(kobo, true);
  const value = BigInt(kobo);
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

/** The one Naira display formatter (en-NG, NGN). Whole amounts hide decimals. */
const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Display-only conversion. Uses the shared Intl formatter, but falls back to
 * exact BigInt-derived text when a float round-trip could lose kobo precision.
 * Doubles round-trip 15 significant decimal digits exactly; below 10^15 kobo
 * the naira amount has at most 13 whole + 2 fraction digits, so Intl is exact.
 * Above it (e.g. MAX_KOBO) Intl's shortest-round-trip formatting drops digits.
 */
const INTL_SAFE_KOBO_LIMIT = 10 ** 15;

export function formatNaira(kobo: number): string {
  const [whole = '0', fraction = '00'] = koboToNaira(kobo).split('.');
  if (kobo < INTL_SAFE_KOBO_LIMIT) {
    return nairaFormatter.format(Number(`${whole}.${fraction}`));
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${grouped}${fraction === '00' ? '' : `.${fraction}`}`;
}
