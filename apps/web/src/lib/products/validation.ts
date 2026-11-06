/**
 * Product form validation — pure functions shared by the form and its tests.
 * Publish requires every field (plus ≥1 uploaded photo); a draft only needs a
 * name (ASSUMPTION DRAFT_REQUIRED_FIELDS). Money/stock text is validated here
 * and converted to kobo/integers exactly once when building the payload.
 */
import { nairaToKobo } from '@/lib/money';
import { MAX_PRODUCT_IMAGES } from './constants';
import type { ProductInput } from './types';

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  sku: string;
  /** Decimal naira text, exactly as typed (grouping tolerated). */
  wholesalePrice: string;
  /** Integer text. */
  stockQuantity: string;
};

export type ProductFormIntent = 'draft' | 'publish';

export type ProductFieldErrors = Partial<Record<keyof ProductFormValues | 'images', string>>;

export const EMPTY_PRODUCT_VALUES: ProductFormValues = {
  name: '',
  description: '',
  category: '',
  sku: '',
  wholesalePrice: '',
  stockQuantity: '',
};

export const PRODUCT_ERROR_MESSAGES = {
  images: 'Add at least one photo.',
  name: 'Enter a product name.',
  category: 'Choose a category.',
  sku: 'Enter a SKU.',
  wholesalePrice: 'Enter a wholesale price.',
  wholesalePriceInvalid: 'Enter a valid price, e.g. 2500 or 2500.50.',
  stockQuantity: 'Enter the stock quantity.',
  stockQuantityInvalid: 'Enter a whole number, e.g. 25.',
} as const;

/** Field order used for "focus the first invalid field". */
export const PRODUCT_FIELD_ORDER: (keyof ProductFormValues | 'images')[] = [
  'images',
  'name',
  'category',
  'sku',
  'wholesalePrice',
  'stockQuantity',
];

export function validateProduct(
  values: ProductFormValues,
  uploadedImageCount: number,
  intent: ProductFormIntent,
): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  const publish = intent === 'publish';

  if (publish && uploadedImageCount === 0) errors.images = PRODUCT_ERROR_MESSAGES.images;
  if (uploadedImageCount > MAX_PRODUCT_IMAGES)
    errors.images = `Use at most ${MAX_PRODUCT_IMAGES} photos.`;

  if (!values.name.trim()) errors.name = PRODUCT_ERROR_MESSAGES.name;
  else if (values.name.trim().length > 200) errors.name = 'Use at most 200 characters.';

  if (values.description.trim().length > 5000) errors.description = 'Use at most 5,000 characters.';

  if (publish && !values.category.trim()) errors.category = PRODUCT_ERROR_MESSAGES.category;
  if (publish && !values.sku.trim()) errors.sku = PRODUCT_ERROR_MESSAGES.sku;
  else if (values.sku.trim().length > 100) errors.sku = 'Use at most 100 characters.';

  const priceText = values.wholesalePrice.trim();
  if (publish && !priceText) {
    errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePrice;
  } else if (priceText) {
    try {
      const kobo = nairaToKobo(priceText);
      if (publish && kobo <= 0) errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePrice;
    } catch {
      errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePriceInvalid;
    }
  }

  const stockText = values.stockQuantity.trim();
  if (publish && !stockText) {
    errors.stockQuantity = PRODUCT_ERROR_MESSAGES.stockQuantity;
  } else if (stockText) {
    const quantity = Number(stockText);
    if (!/^\d+$/.test(stockText) || !Number.isSafeInteger(quantity) || quantity < 0) {
      errors.stockQuantity = PRODUCT_ERROR_MESSAGES.stockQuantityInvalid;
    }
  }

  return errors;
}

/**
 * Build the API payload. Draft blanks become empty strings / 0 so a partial
 * draft round-trips; publish values are already validated.
 */
export function productInputFromValues(
  values: ProductFormValues,
  imageIds: string[],
): ProductInput {
  let wholesalePrice = 0;
  const priceText = values.wholesalePrice.trim();
  if (priceText) {
    try {
      wholesalePrice = nairaToKobo(priceText);
    } catch {
      wholesalePrice = 0;
    }
  }
  const stockText = values.stockQuantity.trim();
  const stockQuantity = /^\d+$/.test(stockText) ? Number.parseInt(stockText, 10) : 0;
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category.trim(),
    sku: values.sku.trim(),
    wholesalePrice,
    stockQuantity: Number.isSafeInteger(stockQuantity) ? stockQuantity : 0,
    imageIds,
  };
}

/** Map a 422/409 ApiError.fields body onto form fields (e.g. duplicate SKU). */
export function serverFieldErrors(fields: Record<string, string> | null): ProductFieldErrors {
  if (!fields) return {};
  const errors: ProductFieldErrors = {};
  const map: Record<string, keyof ProductFormValues | 'images'> = {
    name: 'name',
    description: 'description',
    category: 'category',
    sku: 'sku',
    wholesalePrice: 'wholesalePrice',
    stockQuantity: 'stockQuantity',
    imageIds: 'images',
    images: 'images',
  };
  for (const [key, message] of Object.entries(fields)) {
    const target = map[key];
    if (target) errors[target] = message;
  }
  return errors;
}
