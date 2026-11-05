/**
 * Supplier Products module models.
 *
 * Money crosses the API boundary as integer kobo (the repo-wide convention in
 * lib/money.ts). The form keeps decimal naira text and converts exactly once.
 * Status is lowercase in this module; the transport maps to/from the legacy
 * uppercase ProductStatus enum in one place (productsApi.ts).
 */

import type { components } from '@sellonit/shared';

export type ProductStatus = 'draft' | 'published';

export type ProductImage = {
  id: string;
  url: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  /** Integer kobo. */
  wholesalePrice: number;
  stockQuantity: number;
  status: ProductStatus;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
  /** Optional server-provided low-stock flag; preferred over the local threshold. */
  lowStock?: boolean;
};

export type ProductSummary = {
  total: number;
  published: number;
  drafts: number;
  lowStock: number;
  outOfStock: number;
};

export type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

export type ProductListParams = {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  q?: string;
  category?: string;
  stock?: StockFilter;
};

export type Paginated<T> = {
  data: T[];
  meta: components['schemas']['PaginationMeta'];
};

export type UploadedImage = {
  id: string;
  url: string;
};

export type ProductCategory = {
  id: string;
  name: string;
};

/** Payload for create/update. Images are referenced by uploaded id. */
export type ProductInput = {
  name: string;
  description: string;
  category: string;
  sku: string;
  /** Integer kobo. */
  wholesalePrice: number;
  stockQuantity: number;
  imageIds: string[];
};

export type UploadImageOptions = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};
