import { z } from 'zod';
import { koboToNaira, nairaToKobo } from '@/lib/money';
import type { CreateProductRequest, Product } from './types';

const koboText = (positive: boolean) => z.string().superRefine((text, context) => {
  try { const kobo = nairaToKobo(text); if (positive && kobo === 0) context.addIssue({ code: 'custom', message: 'Base price must be greater than zero.' }); }
  catch (error) { context.addIssue({ code: 'custom', message: error instanceof RangeError ? error.message : 'Enter a valid naira amount.' }); }
});
/** Form text is the only naira-valued state; submitted/state/API money is integer kobo. */
export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a product name.').max(200, 'Use at most 200 characters.'),
  description: z.string().trim().max(5000, 'Use at most 5,000 characters.'),
  category: z.string().trim().min(1, 'Enter a category.').max(120, 'Use at most 120 characters.'),
  sku: z.string().trim().min(1, 'Enter a SKU.').max(100, 'Use at most 100 characters.'),
  basePriceNaira: koboText(true),
  hasMaximumMarkup: z.boolean(),
  maxMarkupNaira: koboText(false),
}).superRefine((value, context) => {
  if (!value.hasMaximumMarkup) return;
  try {
    const sum = BigInt(nairaToKobo(value.basePriceNaira)) + BigInt(nairaToKobo(value.maxMarkupNaira));
    if (sum > BigInt(Number.MAX_SAFE_INTEGER)) context.addIssue({ code: 'custom', path: ['maxMarkupNaira'], message: 'Base price plus markup is too large.' });
  } catch { /* Individual field issues already explain invalid text. */ }
});
export type ProductFormValues = z.infer<typeof productFormSchema>;
export function productFormValues(product?: Product): ProductFormValues {
  const markup = product?.pricingRule.maxMarkupKobo;
  return {
    name: product?.name ?? '', description: product?.description ?? '', category: product?.category ?? '',
    sku: product?.defaultVariant.sku ?? '', basePriceNaira: product ? koboToNaira(product.defaultVariant.basePriceKobo) : '',
    hasMaximumMarkup: markup !== null && markup !== undefined,
    maxMarkupNaira: markup !== null && markup !== undefined ? koboToNaira(markup) : '0',
  };
}

export function productRequestBody(values: ProductFormValues): CreateProductRequest {
  const parsed = productFormSchema.parse(values);
  return { name: parsed.name, description: parsed.description, category: parsed.category, defaultVariant: { sku: parsed.sku, basePriceKobo: nairaToKobo(parsed.basePriceNaira) } };
}
export function markupRequestBody(values: ProductFormValues): number | null {
  return values.hasMaximumMarkup ? nairaToKobo(values.maxMarkupNaira) : null;
}
