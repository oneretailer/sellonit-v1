/**
 * Business-scoped Supplier Profile API client and React Query hooks.
 *
 * Wired to the live routes mounted in `apps/api/src/http/routes/supplier.routes.ts`:
 * - `GET  /api/v1/supplier/:businessId/profile`
 * - `PUT  /api/v1/supplier/:businessId/profile`
 * - `POST /api/v1/supplier/:businessId/profile/submit`
 *
 * Always passes `:businessId` in the URL (and `businessId` in mutation bodies)
 * because the backend resolves tenancy from `req.params.businessId ?? req.body.businessId`
 * rather than `X-Business-Id` (see `supplier.handlers.ts:38-58` and `BE-004`).
 */
import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { QueryClientContext, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@sellonit/shared';
import { apiFetch } from '@/lib/api-client';

type Schemas = components['schemas'];

export type SupplierProfileStatus = Schemas['SupplierReviewStatus'];
export type RetailerAccessMode = NonNullable<Schemas['SupplierProfile']['retailerAccess']>;
export type SupplierOriginAddress = Partial<Schemas['Address']>;

/**
 * Live `SupplierProfile` response shape. Before the first `PUT`, `GET` returns
 * a synthetic `{ businessId, status: 'DRAFT' }` (`supplier.handlers.ts:79`), so
 * `id`, `retailerAccess`, and timestamps are optional until saved.
 */
export type SupplierProfileRecord = {
  id?: string;
  businessId: string;
  status: SupplierProfileStatus;
  legalName?: string | null;
  description?: string | null;
  contactPhone?: string | null;
  originLocation?: SupplierOriginAddress | null;
  retailerAccess?: RetailerAccessMode;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertSupplierProfilePayload = {
  legalName?: string;
  description?: string;
  contactPhone?: string;
  originLocation?: SupplierOriginAddress;
  retailerAccess?: RetailerAccessMode;
};

export const supplierProfileKeys = {
  all: ['supplier-profile'] as const,
  detail: (businessId: string | null) => ['supplier-profile', businessId] as const,
};

function profilePath(businessId: string): string {
  return `/supplier/${encodeURIComponent(businessId)}/profile`;
}

export async function getSupplierProfile(
  businessId: string,
  signal?: AbortSignal,
): Promise<SupplierProfileRecord> {
  const response = await apiFetch<{ data: SupplierProfileRecord }>(profilePath(businessId), {
    method: 'GET',
    signal,
  });
  return response.data;
}

export async function upsertSupplierProfile(
  businessId: string,
  payload: UpsertSupplierProfilePayload,
): Promise<SupplierProfileRecord> {
  const response = await apiFetch<{ data: SupplierProfileRecord }>(profilePath(businessId), {
    method: 'PUT',
    body: JSON.stringify({ businessId, ...payload }),
  });
  return response.data;
}

export async function submitSupplierProfile(businessId: string): Promise<SupplierProfileRecord> {
  const response = await apiFetch<{ data: SupplierProfileRecord }>(
    `${profilePath(businessId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    },
  );
  return response.data;
}

/**
 * Step 2 ("Supplier profile") in the setup checklist is complete once the
 * supplier has submitted their profile for review (`PENDING_REVIEW` or `APPROVED`).
 */
export function isSupplierProfileStepComplete(
  profile: SupplierProfileRecord | null | undefined,
): boolean {
  return profile?.status === 'PENDING_REVIEW' || profile?.status === 'APPROVED';
}

export function useSupplierProfileQuery(businessId: string | null) {
  return useQuery({
    queryKey: supplierProfileKeys.detail(businessId),
    queryFn: ({ signal }) => getSupplierProfile(businessId!, signal),
    enabled: Boolean(businessId),
  });
}

export function useSaveSupplierProfileMutation(businessId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertSupplierProfilePayload) => {
      if (!businessId) throw new Error('Select a supplier business first.');
      return upsertSupplierProfile(businessId, payload);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(supplierProfileKeys.detail(saved.businessId), saved);
    },
  });
}

export function useSubmitSupplierProfileMutation(businessId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: UpsertSupplierProfilePayload) => {
      if (!businessId) throw new Error('Select a supplier business first.');
      if (payload) {
        await upsertSupplierProfile(businessId, payload);
      }
      return submitSupplierProfile(businessId);
    },
    onSuccess: (submitted) => {
      queryClient.setQueryData(supplierProfileKeys.detail(submitted.businessId), submitted);
    },
  });
}

const noopUnsubscribe = () => () => undefined;

/**
 * Reads and warms the active supplier profile when a QueryClient is present,
 * while safely returning `null` in isolated component unit tests that render
 * without `<QueryProvider>`.
 */
export function useOptionalSupplierProfile(
  businessId: string | null,
): SupplierProfileRecord | null {
  const queryClient = useContext(QueryClientContext);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!queryClient || !businessId) return noopUnsubscribe();
      return queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash.includes('supplier-profile')) {
          onStoreChange();
        }
      });
    },
    [businessId, queryClient],
  );

  const getSnapshot = useCallback((): SupplierProfileRecord | null => {
    if (!queryClient || !businessId) return null;
    return (
      queryClient.getQueryData<SupplierProfileRecord>(supplierProfileKeys.detail(businessId)) ??
      null
    );
  }, [businessId, queryClient]);

  useEffect(() => {
    if (!queryClient || !businessId) return;
    const state = queryClient.getQueryState(supplierProfileKeys.detail(businessId));
    if (state?.status === 'pending' || state?.status === 'error') return;
    if (state?.data !== undefined && Date.now() - state.dataUpdatedAt < 30_000) return;
    void queryClient
      .fetchQuery({
        queryKey: supplierProfileKeys.detail(businessId),
        queryFn: ({ signal }) => getSupplierProfile(businessId, signal),
        staleTime: 30_000,
      })
      .catch(() => {
        // Errors are surfaced on the Supplier Profile screen itself.
      });
  }, [businessId, queryClient]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
