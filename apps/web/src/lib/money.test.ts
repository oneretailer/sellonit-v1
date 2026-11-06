import { describe, expect, it } from 'vitest';
import { formatNaira, koboToNaira, MAX_KOBO, nairaToKobo } from './money';

describe('exact kobo conversion', () => {
  it.each([
    ['0', 0],
    ['0.29', 29],
    ['1.2', 120],
    ['1,234.56', 123456],
    ['90071992547409.91', MAX_KOBO],
  ])('parses %s exactly', (text, kobo) => expect(nairaToKobo(text)).toBe(kobo));
  it.each(['', '-1', '1.001', '1e3', 'NaN', '1,00', '90071992547410'])('rejects %s', (text) =>
    expect(() => nairaToKobo(text)).toThrow(RangeError),
  );
  it('round-trips without floating-point multiplication', () =>
    expect(koboToNaira(nairaToKobo('0.29'))).toBe('0.29'));
  it('formats fractional kobo without losing precision', () =>
    expect(formatNaira(123456)).toBe('₦1,234.56'));
  it('formats whole naira without forced decimals', () =>
    expect(formatNaira(100000000)).toBe('₦1,000,000'));
  it('keeps every kobo digit at the safe-integer boundary', () =>
    expect(formatNaira(MAX_KOBO)).toBe('₦90,071,992,547,409.91'));
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid kobo %s', (kobo) =>
    expect(() => formatNaira(kobo)).toThrow(),
  );
});
