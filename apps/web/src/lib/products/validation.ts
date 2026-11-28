/**
 * Product form validation — pure functions shared by the form and its tests.
 * Money/stock text is validated here and converted to kobo/integers exactly
 * once when building the payload.
 *
 * Supports capability-aware rules (`ValidateProductOptions`) so live PR #18
 * (`WorkspaceProduct` contract: no photos/stock, `defaultVariant.{sku,basePriceKobo}`
 * required even on drafts) and full mock capabilities share one validator.
 */
import type { ApiError } from '@/lib/api-client';
import { nairaToKobo } from '@/lib/money';
import { MAX_PRODUCT_IMAGES } from './constants';
import type { ProductCapabilities, ProductInput } from './types';

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

export type ValidateProductOptions = {
  requirePhotos?: boolean;
  requireStock?: boolean;
  /** True on PR #18 `/supplier/products`, where `defaultVariant.{sku,basePriceKobo}` is required on `POST`. */
  requireVariantOnDraft?: boolean;
};

export function validationOptionsForCapabilities(
  capabilities: Pick<ProductCapabilities, 'images' | 'stock'>,
): ValidateProductOptions {
  return {
    requirePhotos: capabilities.images,
    requireStock: capabilities.stock,
    requireVariantOnDraft: !capabilities.stock,
  };
}

export const DEFAULT_DRAFT_PRODUCT_NAME = 'Untitled product';

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

function hasAnyDraftInput(values: ProductFormValues, uploadedImageCount: number): boolean {
  return (
    uploadedImageCount > 0 ||
    Boolean(
      values.name.trim() ||
      values.description.trim() ||
      values.category.trim() ||
      values.sku.trim() ||
      values.wholesalePrice.trim() ||
      values.stockQuantity.trim(),
    )
  );
}

export function validateProduct(
  values: ProductFormValues,
  uploadedImageCount: number,
  intent: ProductFormIntent,
  options: ValidateProductOptions = {},
): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  const publish = intent === 'publish';
  const requirePhotos = options.requirePhotos ?? true;
  const requireStock = options.requireStock ?? true;
  const requireVariant = publish || (options.requireVariantOnDraft ?? false);

  if (publish && requirePhotos && uploadedImageCount === 0) {
    errors.images = PRODUCT_ERROR_MESSAGES.images;
  }
  if (uploadedImageCount > MAX_PRODUCT_IMAGES) {
    errors.images = `Use at most ${MAX_PRODUCT_IMAGES} photos.`;
  }

  if (publish && !values.name.trim()) {
    errors.name = PRODUCT_ERROR_MESSAGES.name;
  } else if (!publish && !hasAnyDraftInput(values, uploadedImageCount)) {
    errors.name = PRODUCT_ERROR_MESSAGES.name;
  } else if (values.name.trim().length > 200) {
    errors.name = 'Use at most 200 characters.';
  }

  if (values.description.trim().length > 5000) errors.description = 'Use at most 5,000 characters.';

  if (publish && !values.category.trim()) errors.category = PRODUCT_ERROR_MESSAGES.category;
  else if (values.category.trim().length > 120) {
    errors.category = 'Use at most 120 characters.';
  }

  if (requireVariant && !values.sku.trim()) errors.sku = PRODUCT_ERROR_MESSAGES.sku;
  else if (values.sku.trim().length > 100) errors.sku = 'Use at most 100 characters.';

  const priceText = values.wholesalePrice.trim();
  if (requireVariant && !priceText) {
    errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePrice;
  } else if (priceText) {
    try {
      const kobo = nairaToKobo(priceText);
      if (requireVariant && kobo <= 0) {
        errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePrice;
      }
    } catch {
      errors.wholesalePrice = PRODUCT_ERROR_MESSAGES.wholesalePriceInvalid;
    }
  }

  const stockText = values.stockQuantity.trim();
  if (publish && requireStock && !stockText) {
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
 * Build the API payload. Draft blanks become empty strings / 0 (and blank name
 * defaults to `DEFAULT_DRAFT_PRODUCT_NAME`) so any partial draft round-trips;
 * publish values are already validated.
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
    name: values.name.trim() || DEFAULT_DRAFT_PRODUCT_NAME,
    description: values.description.trim(),
    category: values.category.trim(),
    sku: values.sku.trim(),
    wholesalePrice,
    stockQuantity: Number.isSafeInteger(stockQuantity) ? stockQuantity : 0,
    imageIds,
  };
}

/** Map a 422/409 ApiError.fields body onto form fields (including `defaultVariant.*` paths). */
export function serverFieldErrors(fields: Record<string, string> | null): ProductFieldErrors {
  if (!fields) return {};
  const errors: ProductFieldErrors = {};
  const map: Record<string, keyof ProductFormValues | 'images'> = {
    name: 'name',
    description: 'description',
    category: 'category',
    sku: 'sku',
    'defaultVariant.sku': 'sku',
    wholesalePrice: 'wholesalePrice',
    basePriceKobo: 'wholesalePrice',
    'defaultVariant.basePriceKobo': 'wholesalePrice',
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

/** Map an `ApiError` from PR #18 (`DUPLICATE_SKU`, message-based `VALIDATION_ERROR`, or `fields`) onto form fields. */
export function serverErrorToFieldErrors(error: ApiError): ProductFieldErrors {
  const fields = serverFieldErrors(error.fields);
  if (Object.keys(fields).length > 0) return fields;

  if (error.code && /SKU/i.test(error.code)) {
    return { sku: 'A product with this SKU already exists. Use a unique SKU.' };
  }
  if (error.code === 'VALIDATION_ERROR') {
    if (/defaultVariant\.sku/i.test(error.message)) {
      return { sku: PRODUCT_ERROR_MESSAGES.sku };
    }
    if (/basePriceKobo/i.test(error.message)) {
      return { wholesalePrice: PRODUCT_ERROR_MESSAGES.wholesalePrice };
    }
    if (/\bname is required\b/i.test(error.message)) {
      return { name: PRODUCT_ERROR_MESSAGES.name };
    }
  }
  return {};
}
