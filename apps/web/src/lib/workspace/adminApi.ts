import { api, unwrap } from '@/lib/api';
import type {
  BusinessSubscription,
  ChangeBusinessSubscriptionInput,
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
  return unwrap(
    api.GET('/admin/suppliers', {
      params: {
        query: {
          status: filters.status,
          page: filters.page,
          pageSize: filters.pageSize,
          ...(trimmedSearch ? { search: trimmedSearch } : {}),
        },
      },
      signal,
    }),
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
      return (
        await unwrap(
          api.POST('/admin/suppliers/{id}/approve', {
            params: { path: { id } },
            body: {
              plan,
              ...(trimmedNote ? { note: trimmedNote } : {}),
            },
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

export async function changeBusinessSubscription(
  businessId: string,
  input: ChangeBusinessSubscriptionInput,
): Promise<BusinessSubscription> {
  return (
    await unwrap(
      api.POST('/admin/businesses/{id}/subscription/change', {
        params: { path: { id: businessId } },
        body: {
          targetPlan: input.targetPlan,
          confirm: true,
          ...(input.choices ? { choices: input.choices } : {}),
        },
      }),
    )
  ).data;
}
