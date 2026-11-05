import { describe, expect, it } from 'vitest';
import { markupRequestBody, productFormSchema, productRequestBody } from './productValidation';
const valid = { name: ' Shirt ', description: ' Cotton ', category: 'Clothing', sku: ' SKU-1 ', basePriceNaira: '0.29', hasMaximumMarkup: false, maxMarkupNaira: '0' };
describe('contract-mirrored product validation', () => {
  it('trims text and submits integer kobo with a single default variant and no stock', () => {
    expect(productRequestBody(valid)).toEqual({ name: 'Shirt', description: 'Cotton', category: 'Clothing', defaultVariant: { sku: 'SKU-1', basePriceKobo: 29 } });
  });
  it.each(['name', 'category', 'sku', 'basePriceNaira'] as const)('requires %s', (field) => expect(productFormSchema.safeParse({ ...valid, [field]: '' }).success).toBe(false));
  it.each(['0', '-1', '1.001', '1e2'])('rejects base price %s', (basePriceNaira) => expect(productFormSchema.safeParse({ ...valid, basePriceNaira }).success).toBe(false));
  it('allows description to be empty', () => expect(productFormSchema.safeParse({ ...valid, description: '' }).success).toBe(true));
  it('rejects oversized fields', () => expect(productFormSchema.safeParse({ ...valid, name: 'x'.repeat(201), sku: 'x'.repeat(101), category: 'x'.repeat(121), description: 'x'.repeat(5001) }).success).toBe(false));
  it('null means no ceiling; zero means fixed base', () => {
    expect(markupRequestBody(valid)).toBeNull(); expect(markupRequestBody({ ...valid, hasMaximumMarkup: true })).toBe(0);
  });
  it('rejects negative/fractional markup and unsafe totals on the correct field', () => {
    expect(productFormSchema.safeParse({ ...valid, hasMaximumMarkup: true, maxMarkupNaira: '-1' }).success).toBe(false);
    const result = productFormSchema.safeParse({ ...valid, basePriceNaira: '90071992547409.91', hasMaximumMarkup: true, maxMarkupNaira: '0.01' });
    expect(result.success).toBe(false); if (!result.success) expect(result.error.issues[0]?.path).toEqual(['maxMarkupNaira']);
  });
});
