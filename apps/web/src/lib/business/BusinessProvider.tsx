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
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { getActiveBusinessId, setActiveBusinessId } from './activeBusiness';
import { listBusinesses, type SwitcherBusiness } from './businessesApi';

export type BusinessPermission =
  | 'product:read'
  | 'product:write'
  | 'product:publish'
  | 'product:delete';

type BusinessContextValue = {
  businesses: SwitcherBusiness[];
  activeBusiness: SwitcherBusiness | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  switchBusiness: (id: string) => void;
  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
  can: (permission: BusinessPermission) => boolean;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

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
    return businesses.find((business) => business.id === activeId) ?? businesses[0] ?? null;
  }, [activeId, businesses]);

  // Keep the transport scope aligned with the resolved active business.
  useEffect(() => {
    setActiveBusinessId(activeBusiness?.id ?? null);
  }, [activeBusiness?.id]);

  const switchBusiness = useCallback((id: string) => {
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
  }, [activeBusiness?.id, pathname, queryClient, router]);

  const can = useCallback((_permission: BusinessPermission) => {
    // TODO(backend): replace with server-resolved grants per role. Owners may
    // do everything today; other roles fail closed until grants exist.
    return activeBusiness?.role === 'OWNER';
  }, [activeBusiness?.role]);

  const refetch = useCallback(() => { void query.refetch(); }, [query]);

  const value = useMemo<BusinessContextValue>(() => ({
    businesses,
    activeBusiness,
    isLoading: query.isPending && status === 'authenticated',
    error: query.error,
    refetch,
    switchBusiness,
    switcherOpen,
    setSwitcherOpen,
    can,
  }), [businesses, activeBusiness, query.isPending, query.error, status, refetch, switchBusiness, switcherOpen, can]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessContextValue {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider.');
  return context;
}
