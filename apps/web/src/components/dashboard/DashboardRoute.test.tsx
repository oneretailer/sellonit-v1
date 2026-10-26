/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { DashboardRoute } from './DashboardRoute';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  pathname: '/dashboard/overview',
  status: 'authenticated',
  refreshSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Next Image is mocked for DOM tests.
    <img {...props} />
  ),
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    status: mocks.status,
    user:
      mocks.status === 'authenticated'
        ? {
            id: 'user-1',
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            phone: null,
            status: 'ACTIVE',
            emailVerifiedAt: null,
            phoneVerifiedAt: null,
            createdAt: '2026-10-26T00:00:00.000Z',
            updatedAt: '2026-10-26T00:00:00.000Z',
          }
        : null,
    cachedDisplayName: 'Ada Lovelace',
    refreshSession: mocks.refreshSession,
  }),
}));
vi.mock('@/lib/dashboard/useSupplierDashboard', () => ({
  useSupplierDashboard: () => ({
    data: EMPTY_SUPPLIER_DASHBOARD,
    isLoading: false,
    error: false,
    retry: vi.fn(),
  }),
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.status = 'authenticated';
  mocks.pathname = '/dashboard/overview';
});

describe('dashboard role and session gates', () => {
  it('routes an authenticated user with no local role to role selection', async () => {
    render(<DashboardRoute mode="overview" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(screen.queryByRole('heading', { name: /Ada!/ })).toBeNull();
  });

  it.each(['entrepreneur', 'retailer'] as const)(
    'routes a %s visiting supplier Overview to its recommendation without looping',
    async (role) => {
      sessionStorage.setItem('sellonit_onboarding_role', role);
      render(<DashboardRoute mode="overview" />);
      await waitFor(() =>
        expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/coming-soon'),
      );
      expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/login');
    },
  );

  it('shows supplier Overview with the authenticated name and local empty state', async () => {
    sessionStorage.setItem('sellonit_onboarding_role', 'supplier');
    render(<DashboardRoute mode="overview" />);
    expect(await screen.findByRole('heading', { name: /Ada!/ })).toBeTruthy();
    expect(
      screen.getByText('No retailer orders yet. Orders from retailers will appear here.'),
    ).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('routes a supplier away from the coming-soon route to Overview', async () => {
    sessionStorage.setItem('sellonit_onboarding_role', 'supplier');
    mocks.pathname = '/dashboard/coming-soon';
    render(<DashboardRoute mode="coming-soon" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(screen.queryByRole('heading', { name: 'Your dashboard is coming soon' })).toBeNull();
  });

  it.each(['entrepreneur', 'retailer'] as const)(
    'shows the shared coming-soon page for %s',
    async (role) => {
      sessionStorage.setItem('sellonit_onboarding_role', role);
      mocks.pathname = '/dashboard/coming-soon';
      render(<DashboardRoute mode="coming-soon" />);
      expect(
        await screen.findByRole('heading', { name: 'Your dashboard is coming soon' }),
      ).toBeTruthy();
      expect(
        screen.getByText("We're building your workspace and we'll let you know when it's ready."),
      ).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'Change how I use Sellonit' }).getAttribute('href'),
      ).toBe('/auth/role-selection');
    },
  );

  it('redirects an unauthenticated dashboard visitor to login without exposing content', async () => {
    mocks.status = 'unauthenticated';
    sessionStorage.setItem('sellonit_onboarding_role', 'supplier');
    render(<DashboardRoute mode="overview" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
    expect(screen.queryByRole('heading', { name: /Ada!/ })).toBeNull();
  });

  it('renders every sidebar destination inside the shared coming-soon panel', async () => {
    sessionStorage.setItem('sellonit_onboarding_role', 'supplier');
    mocks.pathname = '/dashboard/products';
    render(<DashboardRoute mode="section" />);
    expect(
      await screen.findByRole('heading', { name: 'This section is coming soon' }),
    ).toBeTruthy();
    expect(screen.getByText('Products is not available yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Products' }).getAttribute('href')).toBe(
      '/dashboard/products',
    );
  });
});
