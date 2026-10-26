/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AuthenticatedAuthRouteGate } from './AuthenticatedAuthRouteGate';
import { RedirectAuthenticatedUser } from './RedirectAuthenticatedUser';
import { clearOnboardingRole, writeOnboardingRole } from '@/lib/auth/flowState';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  pathname: '/auth/login',
  status: 'authenticated',
  refreshSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    status: mocks.status,
    user: mocks.status === 'authenticated' ? { firstName: 'Jane', lastName: 'Doe' } : null,
    cachedDisplayName: 'Jane Doe',
    refreshSession: mocks.refreshSession,
  }),
}));

const child = <p>Public auth content</p>;

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingRole();
  mocks.pathname = '/auth/login';
  mocks.status = 'authenticated';
});

describe('authenticated entry gates', () => {
  it.each(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/welcome'])(
    'routes an authenticated visit to %s through the role lookup',
    async (pathname) => {
      mocks.pathname = pathname;
      render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
      await waitFor(() =>
        expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'),
      );
      expect(screen.queryByText('Public auth content')).toBeNull();
    },
  );

  it('sends authenticated suppliers from auth entry routes to Overview', async () => {
    writeOnboardingRole('supplier');
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
  });

  it('sends an authenticated retailer through its coming-soon recommendation', async () => {
    writeOnboardingRole('retailer');
    render(
      <RedirectAuthenticatedUser locationKey="/">
        <p>Landing</p>
      </RedirectAuthenticatedUser>,
    );
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/coming-soon'),
    );
  });

  it('does not render logged-out content while the shared session is unresolved', () => {
    mocks.status = 'checking';
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">{child}</RedirectAuthenticatedUser>,
    );
    expect(screen.queryByText('Public auth content')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows public content for a confirmed signed-out session', () => {
    mocks.status = 'unauthenticated';
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">{child}</RedirectAuthenticatedUser>,
    );
    expect(screen.getByText('Public auth content')).toBeTruthy();
  });

  it('keeps the verification callback on its account-mismatch flow', () => {
    mocks.pathname = '/auth/verify-email/confirm';
    mocks.status = 'unauthenticated';
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
  });

  it('keeps role selection on its own authenticated role guard', () => {
    mocks.pathname = '/auth/role-selection';
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
