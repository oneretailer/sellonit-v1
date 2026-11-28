/**
 * Supplier Products module models.
 *
 * Money crosses the API boundary as integer kobo (the repo-wide convention in
 * lib/money.ts). The form keeps decimal naira text and converts exactly once.
 * Transport types derive directly from `@sellonit/shared` (`WorkspaceProduct`,
 * `CreateWorkspaceProductRequest`, `UpdateWorkspaceProductRequest`,
 * `SetMaximumMarkupRequest`); status is normalized to lowercase in `productsApi.ts`.
 */

import type { components } from '@sellonit/shared';

type Schemas = components['schemas'];

export type WorkspaceProductDto = Schemas['WorkspaceProduct'];
export type WorkspaceDefaultVariantDto = Schemas['WorkspaceDefaultVariant'];
export type CreateWorkspaceProductRequestDto = Schemas['CreateWorkspaceProductRequest'];
export type UpdateWorkspaceProductRequestDto = Schemas['UpdateWorkspaceProductRequest'];
export type SetMaximumMarkupRequestDto = Schemas['SetMaximumMarkupRequest'];
export type MaximumMarkupPricingRule = Schemas['MaximumMarkupPricingRule'];
export type ApiProductStatus = Schemas['ProductStatus'];

export type ProductStatus = 'draft' | 'published' | 'unpublished' | 'archived';

export type ProductImage = {
  id: string;
  url: string;
};

export type Product = {
  id: string;
  businessId?: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  /** Integer kobo (`defaultVariant.basePriceKobo` in `WorkspaceProduct`). */
  wholesalePrice: number;
  /** `null` when physical stock is not tracked on the backend response (`PR #18`). */
  stockQuantity: number | null;
  status: ProductStatus;
  pricingRule?: MaximumMarkupPricingRule;
  publishedAt?: string | null;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
  /** Optional server-provided low-stock flag; preferred over the local threshold. */
  lowStock?: boolean;
};

/**
 * Contract capabilities exposed by `productsApi.getCapabilities()`.
 * Live PR #18 (`WorkspaceProduct`) persists `name`, `description`, `category`
 * text, `defaultVariant.{sku,basePriceKobo}`, `pricingRule`, and `publish`,
 * without images, physical stock, `/categories`, `/summary`, `/unpublish`, or `DELETE`.
 */
export type ProductCapabilities = {
  images: boolean;
  stock: boolean;
  categoriesEndpoint: boolean;
  summaryEndpoint: boolean;
  serverStatusAndCategoryFilters: boolean;
  unpublish: boolean;
  remove: boolean;
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
  meta: Schemas['PaginationMeta'];
};

export type UploadedImage = {
  id: string;
  url: string;
};

export type ProductCategory = {
  id: string;
  name: string;
};

/** Payload for create/update. Mapped to `CreateWorkspaceProductRequest` / `UpdateWorkspaceProductRequest` in `productsApi.ts`. */
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
