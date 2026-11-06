import { api, unwrap } from '@/lib/api';
import type { SupplierAction, SupplierPlan, SupplierStatus } from './types';

export async function listSuppliers(
  filters: { status: SupplierStatus; page: number; pageSize: number },
  signal?: AbortSignal,
) {
  return unwrap(api.GET('/admin/suppliers', { params: { query: filters }, signal }));
}
export async function getSupplier(id: string, signal?: AbortSignal) {
  return (await unwrap(api.GET('/admin/suppliers/{id}', { params: { path: { id } }, signal })))
    .data;
}
export async function transitionSupplier(
  id: string,
  action: SupplierAction,
  input: { plan?: SupplierPlan; reason?: string },
) {
  switch (action) {
    case 'approve':
      return (
        await unwrap(
          api.POST('/admin/suppliers/{id}/approve', {
            params: { path: { id } },
            body: { plan: input.plan ?? 'ENTERPRISE' },
          }),
        )
      ).data;
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
