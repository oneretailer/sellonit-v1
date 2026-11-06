/**
 * Mock state + factories for products DOM tests. No React/component imports:
 * per-file `vi.mock` factories dynamically import THIS module, so it must not
 * import anything that itself imports the mocked modules (no cycles).
 */
import { vi } from 'vitest';
import type { SwitcherBusiness } from '@/lib/business/businessesApi';

export const navMocks = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/dashboard/products',
  search: '',
};

export const businessMocks = {
  can: vi.fn((_permission: string) => true),
  switchBusiness: vi.fn((_id: string) => undefined),
  setSwitcherOpen: vi.fn((_open: boolean) => undefined),
  refetch: vi.fn(() => undefined),
  switcherOpen: false,
  isLoading: false,
  error: null as unknown,
  businesses: [
    {
      id: 'biz-1',
      name: 'Okechukwu Fashion',
      type: 'SUPPLIER',
      status: 'ACTIVE',
      role: 'OWNER',
      plan: null,
    },
    {
      id: 'biz-2',
      name: 'Lagos Fabrics',
      type: 'SUPPLIER',
      status: 'ACTIVE',
      role: 'MANAGER',
      plan: null,
    },
  ] as SwitcherBusiness[],
  activeIndex: 0,
};

export function navigationMockFactory() {
  return {
    useRouter: () => ({ push: navMocks.push, replace: navMocks.replace, back: navMocks.back }),
    usePathname: () => navMocks.pathname,
    useSearchParams: () => new URLSearchParams(navMocks.search),
  };
}

export function businessMockFactory() {
  return {
    useBusiness: () => ({
      businesses: businessMocks.businesses,
      activeBusiness: businessMocks.businesses[businessMocks.activeIndex] ?? null,
      isLoading: businessMocks.isLoading,
      error: businessMocks.error,
      refetch: businessMocks.refetch,
      switchBusiness: businessMocks.switchBusiness,
      switcherOpen: businessMocks.switcherOpen,
      setSwitcherOpen: businessMocks.setSwitcherOpen,
      can: businessMocks.can,
    }),
  };
}

export function resetProductsMocks(): void {
  navMocks.push.mockReset();
  navMocks.replace.mockReset();
  navMocks.back.mockReset();
  navMocks.pathname = '/dashboard/products';
  navMocks.search = '';
  businessMocks.can.mockReset().mockReturnValue(true);
  businessMocks.switchBusiness.mockReset();
  businessMocks.setSwitcherOpen.mockReset();
  businessMocks.refetch.mockReset();
  businessMocks.switcherOpen = false;
  businessMocks.isLoading = false;
  businessMocks.error = null;
  businessMocks.activeIndex = 0;
}
