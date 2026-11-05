/**
 * Products module data layer — the ONLY file that knows the product endpoints.
 *
 * TODO(backend): these endpoints are ASSUMED because the API has not implemented
 * them yet. They intentionally follow the Products module brief, not the older
 * PROPOSED /supplier/products contract in docs/openapi.yaml (which has no stock,
 * photos, summary, categories, uploads or delete). When the backend is ready,
 * reconcile the contract here and in docs/openapi.yaml; UI code should not change.
 *
 * Assumed contract (relative to /api/v1):
 *   GET    /supplier/products                  ?page&pageSize&status&q&category&stock
 *   GET    /supplier/products/summary
 *   GET    /supplier/products/:id
 *   POST   /supplier/products
 *   PATCH  /supplier/products/:id
 *   DELETE /supplier/products/:id
 *   POST   /supplier/products/:id/publish
 *   POST   /supplier/products/:id/unpublish
 *   GET    /supplier/categories
 *   POST   /supplier/uploads/product-images    (multipart, progress + abort)
 *
 * Auth is the same same-origin cookie transport as the rest of the app; the
 * active business header is added by api-client.ts. 401s surface as ApiError and
 * are handled by the existing session guard.
 */
import { API_BASE_PATH, ApiError, apiFetch } from '@/lib/api-client';
import { ACTIVE_BUSINESS_HEADER, getActiveBusinessId } from '@/lib/business/activeBusiness';
import type {
  Paginated,
  Product,
  ProductCategory,
  ProductInput,
  ProductListParams,
  ProductSummary,
  UploadImageOptions,
  UploadedImage,
} from './types';

function queryString(params: ProductListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.category) search.set('category', params.category);
  if (params.stock && params.stock !== 'all') search.set('stock', params.stock);
  return search.toString();
}

export const productsApi = {
  list(params: ProductListParams, signal?: AbortSignal): Promise<Paginated<Product>> {
    return apiFetch<Paginated<Product>>(`/supplier/products?${queryString(params)}`, { method: 'GET', signal });
  },

  summary(signal?: AbortSignal): Promise<ProductSummary> {
    return apiFetch<{ data: ProductSummary }>('/supplier/products/summary', { method: 'GET', signal })
      .then((response) => response.data);
  },

  get(id: string, signal?: AbortSignal): Promise<Product> {
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}`, { method: 'GET', signal })
      .then((response) => response.data);
  },

  create(input: ProductInput): Promise<Product> {
    return apiFetch<{ data: Product }>('/supplier/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data);
  },

  update(id: string, input: Partial<ProductInput>): Promise<Product> {
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((response) => response.data);
  },

  async remove(id: string): Promise<void> {
    await apiFetch<null>(`/supplier/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  publish(id: string): Promise<Product> {
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}/publish`, { method: 'POST' })
      .then((response) => response.data);
  },

  unpublish(id: string): Promise<Product> {
    return apiFetch<{ data: Product }>(`/supplier/products/${encodeURIComponent(id)}/unpublish`, { method: 'POST' })
      .then((response) => response.data);
  },

  getCategories(signal?: AbortSignal): Promise<ProductCategory[]> {
    return apiFetch<{ data: ProductCategory[] }>('/supplier/categories', { method: 'GET', signal })
      .then((response) => response.data);
  },

  /**
   * Best-effort cleanup of a photo uploaded in an unsaved session (discard).
   * TODO(backend): no delete-upload endpoint exists yet; failures are swallowed
   * by callers so discarding never blocks on cleanup.
   */
  async deleteImage(id: string): Promise<void> {
    await apiFetch<null>(`/supplier/uploads/product-images/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = (): void => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText) as { data?: UploadedImage };
            if (!body.data?.id || !body.data.url) throw new Error('missing image');
            resolve(body.data);
          } catch {
            reject(new ApiError(xhr.status, null, 'We received an unexpected upload response. Please try again.'));
          }
          return;
        }
        let message = 'Upload failed. Please try again.';
        let code: string | null = null;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: { code?: string; message?: string } };
          code = body.error?.code ?? null;
          message = body.error?.message ?? message;
        } catch { /* keep fallback */ }
        reject(new ApiError(xhr.status, code, message));
      };
      xhr.onerror = (): void => { cleanup(); reject(new ApiError(0, null, 'Network request failed')); };
      xhr.onabort = (): void => { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')); };

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};

export type ProductsApi = typeof productsApi;
