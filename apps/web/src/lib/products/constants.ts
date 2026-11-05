/**
 * Named assumptions for the Products module. Change them here when the backend
 * or product owner confirms real rules.
 */

/** Units 1..LOW_STOCK_THRESHOLD (inclusive) are "low stock"; 0 is out of stock. */
export const LOW_STOCK_THRESHOLD = 10;

/** Server-side page size for the products list (design's 6 rows was sample data). */
export const PRODUCTS_PAGE_SIZE = 10;

/** ASSUMPTION: max upload size per photo (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** ASSUMPTION: max photos per product. */
export const MAX_PRODUCT_IMAGES = 8;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

/** ASSUMPTION: a draft may be saved with only a product name. */
export const DRAFT_REQUIRED_FIELDS = ['name'] as const;

/** Fields required to publish. */
export const PUBLISH_REQUIRED_FIELDS = [
  'images',
  'name',
  'category',
  'sku',
  'wholesalePrice',
  'stockQuantity',
] as const;

/** Debounce for the list search input. */
export const SEARCH_DEBOUNCE_MS = 300;

export const PRODUCT_ROUTES = {
  list: '/dashboard/products',
  new: '/dashboard/products/new',
  edit: (id: string) => `/dashboard/products/${id}/edit` as const,
} as const;
