/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { DashboardRoute } from './DashboardRoute';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import type { AuthUser } from '@/lib/auth/types';

const NOT_FOUND = 'NEXT_NOT_FOUND';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  notFound: vi.fn(),
  pathname: '/dashboard/overview',
  status: 'authenticated',
  user: null as AuthUser | null,
  refreshSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
  notFound: () => {
    mocks.notFound();
    throw new Error('NEXT_NOT_FOUND');
  },
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
    user: mocks.user,
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

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: null,
    status: 'ACTIVE',
    emailVerifiedAt: '2026-10-26T00:00:00.000Z',
    phoneVerifiedAt: null,
    onboardingIntent: null,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.status = 'authenticated';
  mocks.pathname = '/dashboard/overview';
  mocks.user = user({ onboardingIntent: 'ENTERPRISE' });
});

describe('dashboard destination guard', () => {
  it('renders supplier Overview for a verified, onboarded supplier without redirecting', async () => {
    render(<DashboardRoute mode="overview" />);
    expect(await screen.findByRole('heading', { name: /Ada!/ })).toBeTruthy();
    expect(
      screen.getByText('No retailer orders yet. Orders from retailers will appear here.'),
    ).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('sends a verified user with no saved onboarding intent to role selection', async () => {
    mocks.user = user({ emailVerifiedAt: '2026-10-26T00:00:00.000Z', onboardingIntent: null });
    render(<DashboardRoute mode="overview" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(screen.queryByRole('heading', { name: /Ada!/ })).toBeNull();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('sends an unverified user to verify email instead of onboarding', async () => {
    mocks.user = user({ emailVerifiedAt: null, onboardingIntent: null });
    render(<DashboardRoute mode="overview" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/verify-email'));
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/role-selection');
  });

  it.each(['RETAILER', 'ENTREPRENEUR'] as const)(
    'renders the custom 404 for an onboarded %s account instead of a dashboard',
    (intent) => {
      mocks.user = user({ onboardingIntent: intent });
      expect(() => render(<DashboardRoute mode="overview" />)).toThrow(NOT_FOUND);
      // React may retry the render once after a throw, so only "at least once".
      expect(mocks.notFound).toHaveBeenCalled();
      // Onboarded users are never sent back through onboarding, and no fake
      // dashboard is rendered for a workspace that does not exist.
      expect(mocks.router.replace).not.toHaveBeenCalled();
    },
  );

  it('renders the custom 404 for a retailer on a dashboard section too', () => {
    mocks.user = user({ onboardingIntent: 'RETAILER' });
    mocks.pathname = '/dashboard/products';
    expect(() => render(<DashboardRoute mode="section" />)).toThrow(NOT_FOUND);
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it('keeps a supplier on a dashboard section (never bounces to Overview)', async () => {
    mocks.pathname = '/dashboard/products';
    render(<DashboardRoute mode="section" />);
    expect(
      await screen.findByRole('heading', { name: 'This section is coming soon' }),
    ).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated visitor to login without exposing content', async () => {
    mocks.status = 'unauthenticated';
    mocks.user = null;
    const { container } = render(<DashboardRoute mode="overview" />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
    expect(container.innerHTML).toBe('');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('shows only the skeleton while the session is loading', () => {
    mocks.status = 'checking';
    mocks.user = null;
    render(<DashboardRoute mode="overview" />);
    expect(screen.getByRole('status', { name: 'Loading workspace' })).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('offers a retry when the session check failed', async () => {
    mocks.status = 'error';
    mocks.user = null;
    render(<DashboardRoute mode="overview" />);
    screen.getByRole('button', { name: 'Try again' }).click();
    await waitFor(() => expect(mocks.refreshSession).toHaveBeenCalledTimes(1));
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
