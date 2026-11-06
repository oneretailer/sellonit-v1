/**
 * Products module data layer — the ONLY file that knows the product endpoints.
 *
 * TODO(BE-002): `/api/v1/supplier/products*`, `/api/v1/supplier/categories`, and
 * `/api/v1/supplier/uploads/product-images*` are not yet mounted in `apps/api`
 * (see `docs/backend-handoff.md` BE-002). Reconcile paths/shapes here once BE-002
 * lands; UI components must not call fetch/XHR directly.
 *
 * Contract (relative to /api/v1):
 *   GET    /supplier/products                  ?page&pageSize&status&q&category&stock&businessId
 *   GET    /supplier/products/summary          ?businessId
 *   GET    /supplier/products/:id              ?businessId
 *   POST   /supplier/products
 *   PATCH  /supplier/products/:id
 *   DELETE /supplier/products/:id
 *   POST   /supplier/products/:id/publish
 *   POST   /supplier/products/:id/unpublish
 *   GET    /supplier/categories                ?businessId
 *   POST   /supplier/uploads/product-images    (multipart, progress + abort)
 */
import { API_BASE_PATH, ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, apiFetch } from '@/lib/api-client';
import { ACTIVE_BUSINESS_HEADER, getActiveBusinessId } from '@/lib/business/activeBusiness';
import type {
  Paginated,
  Product,
  ProductCategory,
  ProductInput,
  ProductListParams,
  ProductStatus,
  ProductSummary,
  UploadImageOptions,
  UploadedImage,
} from './types';

function withBusinessQuery(search: URLSearchParams): string {
  const businessId = getActiveBusinessId();
  if (businessId && !search.has('businessId')) {
    search.set('businessId', businessId);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function queryString(params: ProductListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.category) search.set('category', params.category);
  if (params.stock && params.stock !== 'all') search.set('stock', params.stock);
  return withBusinessQuery(search);
}

function normalizeProductStatus(status: string): ProductStatus {
  return status.toLowerCase() === 'published' ? 'published' : 'draft';
}

function normalizeProduct(raw: Product): Product {
  return {
    ...raw,
    status: normalizeProductStatus(raw.status),
    images: Array.isArray(raw.images) ? raw.images : [],
  };
}

export const productsApi = {
  async list(params: ProductListParams, signal?: AbortSignal): Promise<Paginated<Product>> {
    const response = await apiFetch<Paginated<Product>>(
      `/supplier/products${queryString(params)}`,
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
    const query = withBusinessQuery(new URLSearchParams());
    return apiFetch<{ data: ProductSummary }>(`/supplier/products/summary${query}`, {
      method: 'GET',
      signal,
    }).then((response) => response.data);
  },

  get(id: string, signal?: AbortSignal): Promise<Product> {
    const query = withBusinessQuery(new URLSearchParams());
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}${query}`, {
      method: 'GET',
      signal,
    }).then((response) => normalizeProduct(response.data));
  },

  create(input: ProductInput): Promise<Product> {
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: Product }>('/supplier/products', {
      method: 'POST',
      body: JSON.stringify(businessId ? { businessId, ...input } : input),
    }).then((response) => normalizeProduct(response.data));
  },

  update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(businessId ? { businessId, ...input } : input),
    }).then((response) => normalizeProduct(response.data));
  },

  async remove(id: string): Promise<void> {
    const query = withBusinessQuery(new URLSearchParams());
    await apiFetch<null>(`/supplier/products/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
    });
  },

  publish(id: string): Promise<Product> {
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: businessId ? JSON.stringify({ businessId }) : undefined,
    }).then((response) => normalizeProduct(response.data));
  },

  unpublish(id: string): Promise<Product> {
    const businessId = getActiveBusinessId();
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
      body: businessId ? JSON.stringify({ businessId }) : undefined,
    }).then((response) => normalizeProduct(response.data));
  },

  getCategories(signal?: AbortSignal): Promise<ProductCategory[]> {
    const query = withBusinessQuery(new URLSearchParams());
    return apiFetch<{ data: ProductCategory[] }>(`/supplier/categories${query}`, {
      method: 'GET',
      signal,
    }).then((response) => response.data);
  },

  /**
   * Best-effort cleanup of a photo uploaded in an unsaved session (discard).
   * TODO(BE-002): mount DELETE /supplier/uploads/product-images/:id on the backend;
   * failures are swallowed by callers so discarding never blocks on cleanup.
   */
  async deleteImage(id: string): Promise<void> {
    await apiFetch<null>(`/supplier/uploads/product-images/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Multipart upload with per-file progress and cancellation. XHR is used because
   * fetch upload progress is not broadly supported. Resolves with the stored image.
   */
  uploadImage(file: File, options: UploadImageOptions = {}): Promise<UploadedImage> {
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
