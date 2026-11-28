/**
 * Inventory module data layer — the ONLY file that knows the inventory endpoints.
 *
 * TODO(BE-014): `/api/v1/supplier/inventory`, `/api/v1/supplier/inventory/summary`,
 * and `/api/v1/supplier/inventory/:productId/adjustments` are not yet mounted in
 * `apps/api` (see `docs/backend-handoff.md` BE-014 & BE-015). Until mounted, the
 * real client surfaces `ENDPOINT_NOT_IMPLEMENTED` so UI renders an honest
 * coming-soon state without faking success.
 *
 * TODO(BE-016): `POST /api/v1/supplier/inventory/import/validate` and
 * `POST /api/v1/supplier/inventory/import` are not yet mounted in `apps/api`;
 * unmounted responses surface `ENDPOINT_NOT_IMPLEMENTED` inside the CSV import
 * modal's `failed` state rather than faking an import.
 *
 * Contract (relative to /api/v1):
 *   GET  /supplier/inventory                         ?page&pageSize&q&status&businessId
 *   GET  /supplier/inventory/summary                 ?businessId
 *   POST /supplier/inventory/:productId/adjustments  { direction, quantity, reason? }
 *   POST /supplier/inventory/import/validate         (multipart CSV upload + validation)
 *   POST /supplier/inventory/import                  { importId?, rows }
 */
import { newIdempotencyKey } from '@/lib/api';
import { API_BASE_PATH, ApiError, ENDPOINT_NOT_IMPLEMENTED_CODE, apiFetch } from '@/lib/api-client';
import { ACTIVE_BUSINESS_HEADER, getActiveBusinessId } from '@/lib/business/activeBusiness';
import { devMockInventory, isDevInventoryMockEnabled } from './devMockInventory';
import { resolveInventoryStockStatus } from './stock';
import type {
  CsvImportConfirmInput,
  CsvImportResult,
  CsvImportValidationResult,
  InventoryItem,
  InventoryListParams,
  InventorySummary,
  Paginated,
  StockAdjustmentInput,
  ValidateCsvOptions,
} from './types';

type RawInventoryItem = {
  productId?: string;
  id?: string;
  supplierProductId?: string;
  name?: string;
  sku?: string;
  imageUrl?: string | null;
  availableQuantity?: number;
  availableCount?: number;
  reservedQuantity?: number | null;
  reservedCount?: number | null;
  stockStatus?: string | null;
  lowStock?: boolean;
};

type RawInventorySummary = {
  total?: number;
  totalProducts?: number;
  low?: number;
  lowStock?: number;
  out?: number;
  outOfStock?: number;
  inStock?: number;
};

function withBusinessQuery(search: URLSearchParams): string {
  const businessId = getActiveBusinessId();
  if (businessId && !search.has('businessId')) {
    search.set('businessId', businessId);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function queryString(params: InventoryListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status && params.status !== 'all') search.set('status', params.status);
  return withBusinessQuery(search);
}

/**
 * Normalizes a backend inventory row without inventing reserved quantities:
 * `reservedQuantity` stays `null` unless the backend explicitly returned a finite number.
 */
export function normalizeInventoryItem(raw: RawInventoryItem): InventoryItem {
  const availableQuantity =
    typeof raw.availableQuantity === 'number' && Number.isFinite(raw.availableQuantity)
      ? raw.availableQuantity
      : typeof raw.availableCount === 'number' && Number.isFinite(raw.availableCount)
        ? raw.availableCount
        : 0;
  const reservedCandidate =
    raw.reservedQuantity !== undefined ? raw.reservedQuantity : raw.reservedCount;
  const reservedQuantity =
    typeof reservedCandidate === 'number' && Number.isFinite(reservedCandidate)
      ? reservedCandidate
      : null;

  return {
    productId: raw.productId ?? raw.supplierProductId ?? raw.id ?? '',
    name: raw.name ?? '',
    sku: raw.sku ?? '',
    imageUrl: typeof raw.imageUrl === 'string' && raw.imageUrl.length > 0 ? raw.imageUrl : null,
    availableQuantity,
    reservedQuantity,
    stockStatus: resolveInventoryStockStatus(availableQuantity, raw.stockStatus, raw.lowStock),
    ...(typeof raw.lowStock === 'boolean' ? { lowStock: raw.lowStock } : {}),
  };
}

export function normalizeInventorySummary(raw: RawInventorySummary): InventorySummary {
  const total = raw.total ?? raw.totalProducts ?? 0;
  const low = raw.low ?? raw.lowStock ?? 0;
  const out = raw.out ?? raw.outOfStock ?? 0;
  const inStock = typeof raw.inStock === 'number' ? raw.inStock : Math.max(0, total - low - out);
  return { total, low, out, inStock };
}

export const inventoryApi = {
  async list(params: InventoryListParams, signal?: AbortSignal): Promise<Paginated<InventoryItem>> {
    if (isDevInventoryMockEnabled()) {
      return devMockInventory.list(getActiveBusinessId(), params);
    }
    const response = await apiFetch<Paginated<RawInventoryItem>>(
      `/supplier/inventory${queryString(params)}`,
      {
        method: 'GET',
        signal,
      },
    );
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeInventoryItem) : [],
    };
  },

  async summary(signal?: AbortSignal): Promise<InventorySummary> {
    if (isDevInventoryMockEnabled()) {
      return devMockInventory.summary(getActiveBusinessId());
    }
    const query = withBusinessQuery(new URLSearchParams());
    const response = await apiFetch<{ data: RawInventorySummary }>(
      `/supplier/inventory/summary${query}`,
      {
        method: 'GET',
        signal,
      },
    );
    return normalizeInventorySummary(response.data);
  },

  /**
   * Sends a delta adjustment (`direction` + `quantity`) rather than an absolute
   * target total so concurrent adjustments and order reservations never clobber
   * one another. Includes `Idempotency-Key` per `docs/Contract_Engineering_Rules.md`.
   */
  async adjustStock(
    productId: string,
    input: StockAdjustmentInput,
    options: { signal?: AbortSignal; idempotencyKey?: string } = {},
  ): Promise<InventoryItem> {
    const businessId = getActiveBusinessId();
    if (isDevInventoryMockEnabled()) {
      return devMockInventory.adjustStock(businessId, productId, input);
    }
    const payload = {
      ...(businessId ? { businessId } : {}),
      direction: input.direction,
      quantity: input.quantity,
      ...(input.reason ? { reason: input.reason } : {}),
    };
    const response = await apiFetch<{ data: RawInventoryItem }>(
      `/supplier/inventory/${encodeURIComponent(productId)}/adjustments`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      },
    );
    return normalizeInventoryItem(response.data);
  },

  /**
   * Uploads a CSV file for row-level validation before applying stock changes.
   * Reports upload byte progress via `onProgress`, then calls `onValidating`
   * once bytes are uploaded while awaiting server validation.
   */
  validateCsvImport(
    file: File,
    options: ValidateCsvOptions = {},
  ): Promise<CsvImportValidationResult> {
    const businessId = getActiveBusinessId();
    if (isDevInventoryMockEnabled()) {
      return devMockInventory.validateCsvImport(businessId, file, options);
    }
    return new Promise<CsvImportValidationResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_PATH}/supplier/inventory/import/validate`);
      xhr.withCredentials = true;
      if (businessId) xhr.setRequestHeader(ACTIVE_BUSINESS_HEADER, businessId);

      const onAbort = (): void => xhr.abort();
      options.signal?.addEventListener('abort', onAbort);
      const cleanup = (): void => options.signal?.removeEventListener('abort', onAbort);

      xhr.upload.onprogress = (event): void => {
        if (event.lengthComputable) {
          options.onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.upload.onload = (): void => {
        options.onProgress?.(100);
        options.onValidating?.();
      };
      xhr.onload = (): void => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText) as { data?: CsvImportValidationResult };
            resolve({
              importId: body.data?.importId,
              validRows: Array.isArray(body.data?.validRows) ? body.data.validRows : [],
              errors: Array.isArray(body.data?.errors) ? body.data.errors : [],
            });
          } catch {
            reject(
              new ApiError(
                xhr.status,
                null,
                'We received an unexpected CSV validation response. Please try again.',
              ),
            );
          }
          return;
        }
        let message = 'Could not validate this CSV file. Please try again.';
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
            message = 'CSV stock import is not available on the server yet.';
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

  /**
   * Confirms a validated CSV stock import (`Idempotency-Key` protected).
   */
  async confirmCsvImport(
    input: CsvImportConfirmInput,
    options: { signal?: AbortSignal; idempotencyKey?: string } = {},
  ): Promise<CsvImportResult> {
    const businessId = getActiveBusinessId();
    if (isDevInventoryMockEnabled()) {
      return devMockInventory.confirmCsvImport(businessId, input);
    }
    const payload = {
      ...(businessId ? { businessId } : {}),
      ...(input.importId ? { importId: input.importId } : {}),
      rows: input.rows,
    };
    const response = await apiFetch<{ data: CsvImportResult }>('/supplier/inventory/import', {
      method: 'POST',
      headers: {
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
    return response.data;
  },
};

export type InventoryApi = typeof inventoryApi;
