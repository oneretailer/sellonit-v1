'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { productsApi } from './productsApi';
import type { Paginated, Product, ProductInput, ProductListParams } from './types';

/** Cache keys include the active business and the filters. */
export const productKeys = {
  all: (businessId: string | null) => ['products', businessId] as const,
  list: (businessId: string | null, params: ProductListParams) => ['products', businessId, 'list', params] as const,
  detail: (businessId: string | null, id: string) => ['products', businessId, 'detail', id] as const,
  summary: (businessId: string | null) => ['product-summary', businessId] as const,
  categories: (businessId: string | null) => ['product-categories', businessId] as const,
};

export function useProductsList(params: ProductListParams) {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: productKeys.list(businessId, params),
    queryFn: ({ signal }) => productsApi.list(params, signal),
    enabled: businessId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useProductSummary() {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: productKeys.summary(businessId),
    queryFn: ({ signal }) => productsApi.summary(signal),
    enabled: businessId !== null,
  });
}

export function useProductCategories() {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: productKeys.categories(businessId),
    queryFn: ({ signal }) => productsApi.getCategories(signal),
    enabled: businessId !== null,
  });
}

export function useProduct(id: string | null) {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return useQuery({
    queryKey: productKeys.detail(businessId, id ?? ''),
    queryFn: ({ signal }) => productsApi.get(id as string, signal),
    enabled: businessId !== null && id !== null,
  });
}

/** Invalidate every product list + summary after a write. */
export function useInvalidateProducts() {
  const queryClient = useQueryClient();
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) }),
      queryClient.invalidateQueries({ queryKey: productKeys.summary(businessId) }),
    ]);
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: ProductInput) => productsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductInput> }) => productsApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: invalidate,
  });
}

/**
 * Optimistic publish/unpublish for the list, with rollback on failure.
 * Summary is invalidated after settle so counts reconcile with the server.
 */
export function usePublishProduct() {
  const queryClient = useQueryClient();
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      publish ? productsApi.publish(id) : productsApi.unpublish(id),
    onMutate: async ({ id, publish }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all(businessId) });
      const previous = queryClient.getQueriesData<Paginated<Product>>({ queryKey: productKeys.all(businessId) });
      const nextStatus = publish ? 'published' : 'draft';
      for (const [key, data] of previous) {
        if (!data?.data) continue;
        queryClient.setQueryData<Paginated<Product>>(key, {
          ...data,
          data: data.data.map((product) => product.id === id ? { ...product, status: nextStatus } : product),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: invalidate,
  });
}
