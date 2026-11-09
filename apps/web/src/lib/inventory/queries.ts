'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { productKeys } from '@/lib/products/queries';
import { inventoryApi } from './inventoryApi';
import type { InventoryListParams, StockAdjustmentInput } from './types';

/** Cache keys include the active business id and filter params. */
export const inventoryKeys = {
  all: (businessId: string | null) => ['inventory', businessId] as const,
  list: (businessId: string | null, params: InventoryListParams) =>
    ['inventory', businessId, 'list', params] as const,
  summary: (businessId: string | null) => ['inventory-summary', businessId] as const,
};

/**
 * Invalidates inventory list + summary AND products list + summary because
 * both `/dashboard/inventory` and `/dashboard/products` display stock counts.
 */
export async function invalidateInventoryAndProducts(
  queryClient: QueryClient,
  businessId: string | null,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all(businessId) }),
    queryClient.invalidateQueries({ queryKey: inventoryKeys.summary(businessId) }),
    queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) }),
    queryClient.invalidateQueries({ queryKey: productKeys.summary(businessId) }),
  ]);
}

export function useInventoryList(params: InventoryListParams) {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: inventoryKeys.list(businessId, params),
    queryFn: ({ signal }) => inventoryApi.list(params, signal),
    enabled: businessId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useInventorySummary() {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: inventoryKeys.summary(businessId),
    queryFn: ({ signal }) => inventoryApi.summary(signal),
    enabled: businessId !== null,
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;

  return useMutation({
    mutationFn: ({
      productId,
      input,
      signal,
      idempotencyKey,
    }: {
      productId: string;
      input: StockAdjustmentInput;
      signal?: AbortSignal;
      idempotencyKey?: string;
    }) => inventoryApi.adjustStock(productId, input, { signal, idempotencyKey }),
    onSuccess: () => invalidateInventoryAndProducts(queryClient, businessId),
  });
}
