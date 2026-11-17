import type { StockLevel } from '@/lib/products/stock';
import type { Paginated } from '@/lib/products/types';

export type { Paginated, StockLevel };

/** API query parameter values for `GET /supplier/inventory?status=...`. */
export type InventoryStatusParam = 'all' | 'low' | 'out' | 'in';

/** URL tab values for `/dashboard/inventory?tab=...`. */
export type InventoryTab = 'all' | 'low-stock' | 'out-of-stock' | 'in-stock';

export type AdjustmentDirection = 'increase' | 'decrease';

export type InventoryItem = {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  availableQuantity: number;
  /**
   * System-managed reserved units.
   * `null` means unavailable from the backend — NEVER coerce `null` to `0`.
   */
  reservedQuantity: number | null;
  stockStatus: StockLevel;
  lowStock?: boolean;
};

export type InventorySummary = {
  total: number;
  low: number;
  out: number;
  inStock: number;
};

export type InventoryListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: InventoryStatusParam;
};

export type StockAdjustmentInput = {
  direction: AdjustmentDirection;
  quantity: number;
  reason?: string;
};

/** 8-stage state machine for the "Import stock from CSV" modal. */
export type CsvImportStage =
  'idle' | 'selected' | 'uploading' | 'validating' | 'errors' | 'ready' | 'complete' | 'failed';

export type CsvImportRowPreview = {
  rowNumber: number;
  sku: string;
  productName?: string;
  availableQuantity: number;
};

export type CsvImportRowError = {
  rowNumber: number;
  sku: string;
  message: string;
};

export type CsvImportValidationResult = {
  importId?: string;
  validRows: CsvImportRowPreview[];
  errors: CsvImportRowError[];
};

export type CsvImportConfirmInput = {
  importId?: string;
  rows: CsvImportRowPreview[];
};

export type CsvImportResult = {
  updatedCount: number;
};

export type ValidateCsvOptions = {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  onValidating?: () => void;
};
