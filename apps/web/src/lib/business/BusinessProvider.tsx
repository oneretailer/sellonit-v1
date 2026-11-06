'use client';

/**
 * Central active-business state for the dashboard.
 *
 * - Persists the active id (localStorage, same mechanism the app already uses
 *   for cross-tab hints) and mirrors it into the API client header scope.
 * - Switching clears every business-scoped cache and lands on Overview.
 * - Exposes the switcher open state so access-state panels can open the menu.
 *
 * TODO(backend): role-based permissions. For now a supplier Owner can do
 * everything; `can` is the single helper to tighten once grants exist.
 */
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { getActiveBusinessId, setActiveBusinessId } from './activeBusiness';
import {
  BusinessContext,
  type BusinessContextValue,
  type BusinessPermission,
} from './BusinessContext';
import { listBusinesses } from './businessesApi';

export type { BusinessContextValue, BusinessPermission };

export const businessKeys = {
  all: ['businesses'] as const,
  list: (userId: string | null) => ['businesses', userId] as const,
};

/** Cache families that must never leak across a business switch. */
export const BUSINESS_SCOPED_CACHE_PREFIXES = [
  ['products'],
  ['product-summary'],
  ['product-categories'],
  ['supplier-dashboard'],
  ['supplier-profile'],
  ['workspace'],
] as const;

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: businessKeys.list(userId),
    queryFn: ({ signal }) => listBusinesses(userId, signal),
    enabled: status === 'authenticated' && userId !== null,
  });
  const businesses = useMemo(() => query.data ?? [], [query.data]);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveBusinessId());
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const activeBusiness = useMemo(() => {
    if (businesses.length === 0) return null;
    if (activeId) {
      const matched = businesses.find((business) => business.id === activeId);
      if (matched) return matched;
    }
    return (
      businesses.find((business) => business.type === 'SUPPLIER' && business.status === 'ACTIVE') ??
      businesses.find((business) => business.type === 'SUPPLIER') ??
      businesses[0] ??
      null
    );
  }, [activeId, businesses]);

  // Keep the transport scope aligned with the resolved active business.
  useEffect(() => {
    setActiveBusinessId(activeBusiness?.id ?? null);
  }, [activeBusiness?.id]);

  const switchBusiness = useCallback(
    (id: string) => {
      if (id === activeBusiness?.id) {
        setSwitcherOpen(false);
        return;
      }
      setActiveId(id);
      setActiveBusinessId(id);
      setSwitcherOpen(false);
      for (const prefix of BUSINESS_SCOPED_CACHE_PREFIXES) {
        queryClient.removeQueries({ queryKey: [...prefix] });
      }
      // Always land on Overview: an edit page belongs to the previous business.
      if (pathname !== '/dashboard/overview') router.push('/dashboard/overview');
    },
    [activeBusiness?.id, pathname, queryClient, router],
  );

  const can = useCallback(
    (permission: BusinessPermission) => {
      // TODO(BE-005): replace with server-resolved permission grants once exposed.
      // Mirrors backend `requireOwnedBusiness` (`OWNER | MANAGER`) for management
      // actions, restricts destructive deletes to `OWNER`, and keeps `STAFF` read-only.
      const role = activeBusiness?.role;
      if (role === 'OWNER') return true;
      if (role === 'MANAGER') return permission !== 'product:delete';
      if (role === 'STAFF') return permission === 'product:read';
      return false;
    },
    [activeBusiness?.role],
  );

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      businesses,
      activeBusiness,
      isLoading: query.isPending && status === 'authenticated',
      error: query.error,
      refetch,
      switchBusiness,
      switcherOpen,
      setSwitcherOpen,
      can,
    }),
    [
      businesses,
      activeBusiness,
      query.isPending,
      query.error,
      status,
      refetch,
      switchBusiness,
      switcherOpen,
      can,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessContextValue {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider.');
  return context;
}

export function useOptionalBusiness(): BusinessContextValue | null {
  return useContext(BusinessContext);
}
