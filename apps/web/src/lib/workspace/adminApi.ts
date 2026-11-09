import { api, unwrap } from '@/lib/api';
import { apiFetch } from '@/lib/api-client';
import type {
  Pagination,
  SupplierAction,
  SupplierDetail,
  SupplierPlan,
  SupplierStatus,
  SupplierSummary,
} from './types';

export type AdminSupplierListFilters = {
  status: SupplierStatus;
  page: number;
  pageSize: number;
  search?: string;
};

export async function listSuppliers(
  filters: AdminSupplierListFilters,
  signal?: AbortSignal,
): Promise<{ data: SupplierSummary[]; meta: Pagination }> {
  const trimmedSearch = filters.search?.trim() ?? '';
  if (!trimmedSearch) {
    return unwrap(
      api.GET('/admin/suppliers', {
        params: {
          query: {
            status: filters.status,
            page: filters.page,
            pageSize: filters.pageSize,
          },
        },
        signal,
      }),
    );
  }

  const params = new URLSearchParams({
    status: filters.status,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    search: trimmedSearch,
  });
  return apiFetch<{ data: SupplierSummary[]; meta: Pagination }>(
    `/admin/suppliers?${params.toString()}`,
    { method: 'GET', signal },
  );
}

export async function getSupplier(id: string, signal?: AbortSignal): Promise<SupplierDetail> {
  return (await unwrap(api.GET('/admin/suppliers/{id}', { params: { path: { id } }, signal })))
    .data;
}

export async function transitionSupplier(
  id: string,
  action: SupplierAction,
  input: { plan?: SupplierPlan; reason?: string; note?: string },
): Promise<SupplierDetail> {
  switch (action) {
    case 'approve': {
      const plan = input.plan ?? 'ENTERPRISE';
      const trimmedNote = input.note?.trim() ?? '';
      if (trimmedNote) {
        return (
          await apiFetch<{ data: SupplierDetail }>(
            `/admin/suppliers/${encodeURIComponent(id)}/approve`,
            {
              method: 'POST',
              body: JSON.stringify({ plan, note: trimmedNote }),
            },
          )
        ).data;
      }
      return (
        await unwrap(
          api.POST('/admin/suppliers/{id}/approve', {
            params: { path: { id } },
            body: { plan },
          }),
        )
      ).data;
    }
    case 'reject':
      return (
        await unwrap(
          api.POST('/admin/suppliers/{id}/reject', {
            params: { path: { id } },
            body: { reason: input.reason ?? '' },
          }),
        )
      ).data;
    case 'suspend':
      return (
        await unwrap(
          api.POST('/admin/suppliers/{id}/suspend', {
            params: { path: { id } },
            body: { reason: input.reason ?? '' },
          }),
        )
      ).data;
    case 'reinstate':
      return (
        await unwrap(api.POST('/admin/suppliers/{id}/reinstate', { params: { path: { id } } }))
      ).data;
  }
}
