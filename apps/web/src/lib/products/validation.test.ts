import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { LIVE_CATALOGUE_CAPABILITIES } from './productsApi';
import {
  DEFAULT_DRAFT_PRODUCT_NAME,
  EMPTY_PRODUCT_VALUES,
  PRODUCT_ERROR_MESSAGES,
  productInputFromValues,
  serverErrorToFieldErrors,
  serverFieldErrors,
  validateProduct,
  validationOptionsForCapabilities,
  type ProductFormValues,
} from './validation';

const complete: ProductFormValues = {
  name: 'Cotton polo shirt',
  description: 'Soft cotton',
  category: 'cat-1',
  sku: 'POLO-CTN-001',
  wholesalePrice: '2500.50',
  stockQuantity: '25',
};

describe('publish validation', () => {
  it('accepts a complete product with one photo', () => {
    expect(validateProduct(complete, 1, 'publish')).toEqual({});
  });

  it('flags every missing field with the exact messages', () => {
    expect(validateProduct(EMPTY_PRODUCT_VALUES, 0, 'publish')).toEqual({
      images: PRODUCT_ERROR_MESSAGES.images,
      name: PRODUCT_ERROR_MESSAGES.name,
      category: PRODUCT_ERROR_MESSAGES.category,
      sku: PRODUCT_ERROR_MESSAGES.sku,
      wholesalePrice: PRODUCT_ERROR_MESSAGES.wholesalePrice,
      stockQuantity: PRODUCT_ERROR_MESSAGES.stockQuantity,
    });
  });

  it('requires at least one uploaded photo', () => {
    expect(validateProduct(complete, 0, 'publish').images).toBe('Add at least one photo.');
  });

  it('rejects malformed prices and non-integer stock', () => {
    const errors = validateProduct(
      { ...complete, wholesalePrice: '12.345', stockQuantity: '2.5' },
      1,
      'publish',
    );
    expect(errors.wholesalePrice).toBe(PRODUCT_ERROR_MESSAGES.wholesalePriceInvalid);
    expect(errors.stockQuantity).toBe(PRODUCT_ERROR_MESSAGES.stockQuantityInvalid);
  });

  it('rejects a zero price for publish but zero stock is valid', () => {
    expect(validateProduct({ ...complete, wholesalePrice: '0' }, 1, 'publish').wholesalePrice).toBe(
      PRODUCT_ERROR_MESSAGES.wholesalePrice,
    );
    expect(validateProduct({ ...complete, stockQuantity: '0' }, 1, 'publish')).toEqual({});
  });
});

describe('draft validation (any field or photo allowed, blank name defaults to Untitled product)', () => {
  it('accepts a name-only draft with no photos', () => {
    expect(validateProduct({ ...EMPTY_PRODUCT_VALUES, name: 'Half entered' }, 0, 'draft')).toEqual(
      {},
    );
  });

  it('accepts a draft when any non-name field or photo is provided', () => {
    expect(validateProduct({ ...EMPTY_PRODUCT_VALUES, sku: 'SF-PS-022' }, 0, 'draft')).toEqual({});
    expect(validateProduct(EMPTY_PRODUCT_VALUES, 1, 'draft')).toEqual({});
  });

  it('prompts when the entire form is completely blank with no photos', () => {
    expect(validateProduct(EMPTY_PRODUCT_VALUES, 0, 'draft').name).toBe(
      PRODUCT_ERROR_MESSAGES.name,
    );
  });

  it('validates malformed optional values even for drafts', () => {
    const errors = validateProduct(
      { ...EMPTY_PRODUCT_VALUES, name: 'X', wholesalePrice: 'abc', stockQuantity: '-2' },
      0,
      'draft',
    );
    expect(errors.wholesalePrice).toBe(PRODUCT_ERROR_MESSAGES.wholesalePriceInvalid);
    expect(errors.stockQuantity).toBe(PRODUCT_ERROR_MESSAGES.stockQuantityInvalid);
  });
});

describe('payload building', () => {
  it('converts naira text to exact integer kobo once', () => {
    const input = productInputFromValues(complete, ['img-1', 'img-2']);
    expect(input).toEqual({
      name: 'Cotton polo shirt',
      description: 'Soft cotton',
      category: 'cat-1',
      sku: 'POLO-CTN-001',
      wholesalePrice: 250050,
      stockQuantity: 25,
      imageIds: ['img-1', 'img-2'],
    });
  });

  it('tolerates grouped price text, blank draft fields, and defaults blank draft names', () => {
    expect(
      productInputFromValues({ ...complete, wholesalePrice: '1,234.56' }, []).wholesalePrice,
    ).toBe(123456);
    const draft = productInputFromValues({ ...EMPTY_PRODUCT_VALUES, name: ' Draft name ' }, []);
    expect(draft).toMatchObject({
      name: 'Draft name',
      wholesalePrice: 0,
      stockQuantity: 0,
      imageIds: [],
    });
    const untitled = productInputFromValues({ ...EMPTY_PRODUCT_VALUES, sku: 'SF-PS-022' }, []);
    expect(untitled.name).toBe(DEFAULT_DRAFT_PRODUCT_NAME);
  });
});

describe('server field errors', () => {
  it('maps known fields and ignores unknown ones', () => {
    expect(serverFieldErrors({ sku: 'SKU already exists.', extra: 'ignored' })).toEqual({
      sku: 'SKU already exists.',
    });
    expect(serverFieldErrors({ 'defaultVariant.sku': 'SKU required.' })).toEqual({
      sku: 'SKU required.',
    });
    expect(serverFieldErrors({ 'defaultVariant.basePriceKobo': 'Positive integer.' })).toEqual({
      wholesalePrice: 'Positive integer.',
    });
    expect(serverFieldErrors({ imageIds: 'Invalid image.' })).toEqual({ images: 'Invalid image.' });
    expect(serverFieldErrors(null)).toEqual({});
  });

  it('maps PR #18 DUPLICATE_SKU and message-only VALIDATION_ERROR onto form fields', () => {
    expect(serverErrorToFieldErrors(new ApiError(409, 'DUPLICATE_SKU', 'SKU already exists'))).toEqual({
      sku: 'A product with this SKU already exists. Use a unique SKU.',
    });
    expect(
      serverErrorToFieldErrors(
        new ApiError(422, 'VALIDATION_ERROR', 'defaultVariant.sku is required'),
      ),
    ).toEqual({ sku: PRODUCT_ERROR_MESSAGES.sku });
    expect(
      serverErrorToFieldErrors(
        new ApiError(422, 'VALIDATION_ERROR', 'basePriceKobo must be a positive safe integer'),
      ),
    ).toEqual({ wholesalePrice: PRODUCT_ERROR_MESSAGES.wholesalePrice });
  });
});

describe('PR #18 live catalogue validation (no photos/stock, variant required on draft)', () => {
  const liveOptions = validationOptionsForCapabilities(LIVE_CATALOGUE_CAPABILITIES);

  it('accepts publish without photos or stock when name, category, SKU, and price > 0 are provided', () => {
    expect(
      validateProduct(
        {
          ...EMPTY_PRODUCT_VALUES,
          name: 'Cotton polo shirt',
          category: 'Apparel',
          sku: 'POLO-001',
          wholesalePrice: '7500',
        },
        0,
        'publish',
        liveOptions,
      ),
    ).toEqual({});
  });

  it('requires SKU and positive price even when saving a draft on PR #18', () => {
    expect(
      validateProduct({ ...EMPTY_PRODUCT_VALUES, name: 'Draft only' }, 0, 'draft', liveOptions),
    ).toEqual({
      sku: PRODUCT_ERROR_MESSAGES.sku,
      wholesalePrice: PRODUCT_ERROR_MESSAGES.wholesalePrice,
    });
    expect(
      validateProduct(
        { ...EMPTY_PRODUCT_VALUES, name: 'Draft with variant', sku: 'DRF-1', wholesalePrice: '500' },
        0,
        'draft',
        liveOptions,
      ),
    ).toEqual({});
  });
});
