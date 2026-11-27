/**
 * Products module data layer — the ONLY file that knows the product endpoints.
 *
 * Synced with PR #18 (`apps/api/src/http/routes/supplier.routes.ts` &
 * `docs/openapi.yaml` `WorkspaceProduct` contract, relative to `/api/v1`):
 *   GET    /supplier/products                  ?page&pageSize&search  (X-Business-Id)
 *   POST   /supplier/products                  CreateWorkspaceProductRequest
 *   GET    /supplier/products/:id                                     (X-Business-Id)
 *   PATCH  /supplier/products/:id              UpdateWorkspaceProductRequest
 *   PUT    /supplier/products/:id/pricing-rule SetMaximumMarkupRequest
 *   POST   /supplier/products/:id/publish      { businessId? }
 *
 * Endpoints still unmounted on `apps/api` (kept isolated here for future BE work
 * and `NEXT_PUBLIC_DEV_MOCK_PRODUCTS=1` dev testing):
 *   GET    /supplier/products/summary
 *   DELETE /supplier/products/:id
 *   POST   /supplier/products/:id/unpublish
 *   GET    /supplier/categories
 *   POST   /supplier/uploads/product-images
 *   DELETE /supplier/uploads/product-images/:id
 */
import { API_BASE_PATH, ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, apiFetch } from '@/lib/api-client';
import { ACTIVE_BUSINESS_HEADER, getActiveBusinessId } from '@/lib/business/activeBusiness';
import { devMockProducts, isDevProductsMockEnabled } from './devMockProducts';
import type {
  CreateWorkspaceProductRequestDto,
  MaximumMarkupPricingRule,
  Paginated,
  Product,
  ProductCapabilities,
  ProductCategory,
  ProductImage,
  ProductInput,
  ProductListParams,
  ProductStatus,
  ProductSummary,
  SetMaximumMarkupRequestDto,
  UpdateWorkspaceProductRequestDto,
  UploadImageOptions,
  UploadedImage,
  WorkspaceProductDto,
} from './types';

export const LIVE_CATALOGUE_CAPABILITIES: ProductCapabilities = {
  images: false,
  stock: false,
  categoriesEndpoint: false,
  summaryEndpoint: false,
  serverStatusAndCategoryFilters: false,
  unpublish: false,
  remove: false,
};

export const FULL_CATALOGUE_CAPABILITIES: ProductCapabilities = {
  images: true,
  stock: true,
  categoriesEndpoint: true,
  summaryEndpoint: true,
  serverStatusAndCategoryFilters: true,
  unpublish: true,
  remove: true,
};

type RawProductPayload = Partial<WorkspaceProductDto> & {
  id: string;
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  wholesalePrice?: number;
  stockQuantity?: number | null;
  status: string;
  images?: ProductImage[];
  createdAt: string;
  updatedAt: string;
  lowStock?: boolean;
};

function withBusinessQuery(search: URLSearchParams): string {
  const businessId = getActiveBusinessId();
  if (businessId && !search.has('businessId')) {
    search.set('businessId', businessId);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function listQueryString(params: ProductListParams): string {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  const trimmedSearch = params.q?.trim() ?? '';
  if (trimmedSearch) query.set('search', trimmedSearch);
  return `?${query.toString()}`;
}

export function normalizeProductStatus(status: string): ProductStatus {
  switch (status.toUpperCase()) {
    case 'PUBLISHED':
      return 'published';
    case 'UNPUBLISHED':
      return 'unpublished';
    case 'ARCHIVED':
      return 'archived';
    default:
      return 'draft';
  }
}

function normalizePricingRule(
  rule: RawProductPayload['pricingRule'],
): MaximumMarkupPricingRule | undefined {
  if (!rule || typeof rule !== 'object') return undefined;
  const rawMarkup = (rule as { maxMarkupKobo?: unknown }).maxMarkupKobo;
  if (rawMarkup === null) return { maxMarkupKobo: null };
  const numeric = typeof rawMarkup === 'number' ? rawMarkup : Number(rawMarkup);
  return Number.isFinite(numeric) ? { maxMarkupKobo: numeric } : { maxMarkupKobo: null };
}

function normalizeProduct(raw: RawProductPayload): Product {
  const variant = raw.defaultVariant;
  const sku = typeof variant?.sku === 'string' ? variant.sku : (raw.sku ?? '');
  const wholesalePrice =
    typeof variant?.basePriceKobo === 'number'
      ? variant.basePriceKobo
      : typeof raw.wholesalePrice === 'number'
        ? raw.wholesalePrice
        : 0;
  const stockQuantity = typeof raw.stockQuantity === 'number' ? raw.stockQuantity : null;
  const pricingRule = normalizePricingRule(raw.pricingRule);

  return {
    id: raw.id,
    ...(raw.businessId ? { businessId: raw.businessId } : {}),
    name: raw.name,
    description: raw.description ?? '',
    category: raw.category ?? '',
    sku,
    wholesalePrice,
    stockQuantity,
    status: normalizeProductStatus(raw.status),
    ...(pricingRule ? { pricingRule } : {}),
    ...(raw.publishedAt !== undefined ? { publishedAt: raw.publishedAt } : {}),
    images: Array.isArray(raw.images) ? raw.images : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    ...(raw.lowStock !== undefined ? { lowStock: raw.lowStock } : {}),
  };
}

function toCreateRequest(
  businessId: string | null,
  input: ProductInput,
): CreateWorkspaceProductRequestDto {
  return {
    ...(businessId ? { businessId } : {}),
    name: input.name,
    description: input.description,
    category: input.category,
    defaultVariant: {
      sku: input.sku,
      basePriceKobo: input.wholesalePrice,
    },
  };
}

function toUpdateRequest(
  businessId: string | null,
  input: Partial<ProductInput>,
): UpdateWorkspaceProductRequestDto {
  const payload: UpdateWorkspaceProductRequestDto = {
    ...(businessId ? { businessId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
  };
  if (input.sku !== undefined && input.wholesalePrice !== undefined) {
    payload.defaultVariant = {
      sku: input.sku,
      basePriceKobo: input.wholesalePrice,
    };
  }
  return payload;
}

export const productsApi = {
  getCapabilities(): ProductCapabilities {
    return isDevProductsMockEnabled() ? FULL_CATALOGUE_CAPABILITIES : LIVE_CATALOGUE_CAPABILITIES;
  },

  async list(params: ProductListParams, signal?: AbortSignal): Promise<Paginated<Product>> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.list(getActiveBusinessId(), params);
    }
    const response = await apiFetch<Paginated<RawProductPayload>>(
      `/supplier/products${listQueryString(params)}`,
      {
        method: 'GET',
        signal,
      },
    );
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeProduct) : [],
    };
  },

  summary(signal?: AbortSignal): Promise<ProductSummary> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.summary(getActiveBusinessId());
    }
    const query = withBusinessQuery(new URLSearchParams());
    return apiFetch<{ data: ProductSummary }>(`/supplier/products/summary${query}`, {
      method: 'GET',
      signal,
    }).then((response) => response.data);
  },

  get(id: string, signal?: AbortSignal): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.get(getActiveBusinessId(), id);
    }
    return apiFetch<{ data: RawProductPayload }>(`/supplier/products/${encodeURIComponent(id)}`, {
      method: 'GET',
      signal,
    }).then((response) => normalizeProduct(response.data));
  },

  create(input: ProductInput): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.create(getActiveBusinessId(), input);
    }
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: RawProductPayload }>('/supplier/products', {
      method: 'POST',
      body: JSON.stringify(toCreateRequest(businessId, input)),
    }).then((response) => normalizeProduct(response.data));
  },

  update(id: string, input: Partial<ProductInput>): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.update(getActiveBusinessId(), id, input);
    }
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: RawProductPayload }>(`/supplier/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(toUpdateRequest(businessId, input)),
    }).then((response) => normalizeProduct(response.data));
  },

  /**
   * `PUT /supplier/products/:id/pricing-rule` (`pricing:set` permission).
   * Note: Backend PR #18 has a known `BigInt` JSON serialization bug when
   * `maxMarkupKobo` is non-null (`apps/api/src/modules/supplier-products/product.response.ts`).
   */
  updatePricingRule(
    id: string,
    maxMarkupKobo: SetMaximumMarkupRequestDto['maxMarkupKobo'],
  ): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.updatePricingRule(getActiveBusinessId(), id, maxMarkupKobo);
    }
    const businessId = getActiveBusinessId();
    const payload: SetMaximumMarkupRequestDto = {
      ...(businessId ? { businessId } : {}),
      maxMarkupKobo,
    };
    return apiFetch<{ data: RawProductPayload }>(
      `/supplier/products/${encodeURIComponent(id)}/pricing-rule`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ).then((response) => normalizeProduct(response.data));
  },

  async remove(id: string): Promise<void> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.remove(getActiveBusinessId(), id);
    }
    const query = withBusinessQuery(new URLSearchParams());
    await apiFetch<null>(`/supplier/products/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
    });
  },

  publish(id: string): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.setPublished(getActiveBusinessId(), id, true);
    }
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: RawProductPayload }>(
      `/supplier/products/${encodeURIComponent(id)}/publish`,
      {
        method: 'POST',
        body: businessId ? JSON.stringify({ businessId }) : undefined,
      },
    ).then((response) => normalizeProduct(response.data));
  },

  unpublish(id: string): Promise<Product> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.setPublished(getActiveBusinessId(), id, false);
    }
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: RawProductPayload }>(
      `/supplier/products/${encodeURIComponent(id)}/unpublish`,
      {
        method: 'POST',
        body: businessId ? JSON.stringify({ businessId }) : undefined,
      },
    ).then((response) => normalizeProduct(response.data));
  },

  getCategories(signal?: AbortSignal): Promise<ProductCategory[]> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.categories();
    }
    const query = withBusinessQuery(new URLSearchParams());
    return apiFetch<{ data: ProductCategory[] }>(`/supplier/categories${query}`, {
      method: 'GET',
      signal,
    }).then((response) => response.data);
  },

  async deleteImage(id: string): Promise<void> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.deleteImage(id);
    }
    await apiFetch<null>(`/supplier/uploads/product-images/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  uploadImage(file: File, options: UploadImageOptions = {}): Promise<UploadedImage> {
    if (isDevProductsMockEnabled()) {
      return devMockProducts.uploadImage(file, options);
    }
    return new Promise<UploadedImage>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_PATH}/supplier/uploads/product-images`);
      xhr.withCredentials = true;
      const businessId = getActiveBusinessId();
      if (businessId) xhr.setRequestHeader(ACTIVE_BUSINESS_HEADER, businessId);

      const onAbort = (): void => xhr.abort();
      options.signal?.addEventListener('abort', onAbort);
      const cleanup = (): void => options.signal?.removeEventListener('abort', onAbort);

      xhr.upload.onprogress = (event): void => {
        if (event.lengthComputable) {
          options.onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = (): void => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText) as { data?: UploadedImage };
            if (!body.data?.id || !body.data.url) throw new Error('missing image');
            resolve(body.data);
          } catch {
            reject(
              new ApiError(
                xhr.status,
                null,
                'We received an unexpected upload response. Please try again.',
              ),
            );
          }
          return;
        }
        let message = 'Upload failed. Please try again.';
        let code: string | null = null;
        try {
          const body = JSON.parse(xhr.responseText) as {
            error?: { code?: string; message?: string };
          };
          code = body.error?.code ?? null;
          message = body.error?.message ?? message;
        } catch {
          if (xhr.status === 404 && /Cannot\s+POST\s+/i.test(xhr.responseText)) {
            code = ENDPOINT_NOT_IMPLEMENTED_CODE;
            message = 'Product image uploads are not available on the server yet.';
          }
        }
        reject(new ApiError(xhr.status, code, message));
      };
      xhr.onerror = (): void => {
        cleanup();
        reject(new ApiError(0, null, 'Network request failed'));
      };
      xhr.onabort = (): void => {
        cleanup();
        reject(new DOMException('Upload cancelled', 'AbortError'));
      };

      const form = new FormData();
      form.append('file', file);
      if (businessId) form.append('businessId', businessId);
      xhr.send(form);
    });
  },
};

export type ProductsApi = typeof productsApi;
