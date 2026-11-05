import { describe, expect, it } from 'vitest';
import { formatNaira, koboToNaira, MAX_KOBO, nairaToKobo } from './money';
import { pricePreview } from './workspace/pricePreview';

describe('exact kobo conversion', () => {
  it.each([['0', 0], ['0.29', 29], ['1.2', 120], ['1,234.56', 123456], ['90071992547409.91', MAX_KOBO]])('parses %s exactly', (text, kobo) => expect(nairaToKobo(text)).toBe(kobo));
  it.each(['', '-1', '1.001', '1e3', 'NaN', '1,00', '90071992547410'])('rejects %s', (text) => expect(() => nairaToKobo(text)).toThrow(RangeError));
  it('round-trips without floating-point multiplication', () => expect(koboToNaira(nairaToKobo('0.29'))).toBe('0.29'));
  it('formats fractional kobo without losing precision', () => expect(formatNaira(123456)).toBe('₦1,234.56'));
});
describe('price preview', () => {
  it('previews an exact inclusive range', () => expect(pricePreview(100029, 200071)).toEqual({ minimumKobo: 100029, maximumKobo: 300100, label: 'Retailers can sell from ₦1,000.29 to ₦3,001.' }));
  it('zero means fixed base', () => expect(pricePreview(100000, 0).label).toBe('Retailers must sell at exactly ₦1,000.'));
  it('null means no ceiling', () => expect(pricePreview(100000, null)).toMatchObject({ maximumKobo: null, label: expect.stringContaining('No maximum markup') }));
  it.each([0, -1, 1.5, NaN])('rejects invalid base %s', (base) => expect(() => pricePreview(base, null)).toThrow());
  it.each([-1, 1.5, MAX_KOBO])('rejects invalid markup %s', (markup) => expect(() => pricePreview(100, markup)).toThrow());
});
