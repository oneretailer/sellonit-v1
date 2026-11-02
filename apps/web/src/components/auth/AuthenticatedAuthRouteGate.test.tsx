/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AuthenticatedAuthRouteGate } from './AuthenticatedAuthRouteGate';
import { RedirectAuthenticatedUser } from './RedirectAuthenticatedUser';

const VERIFIED = '2026-10-26T00:00:00.000Z';

type SessionUser = {
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  onboardingIntent: string | null;
};

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  pathname: '/auth/login',
  status: 'authenticated',
  user: null as SessionUser | null,
  refreshSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    status: mocks.status,
    user: mocks.user,
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
  mocks.pathname = '/auth/login';
  mocks.status = 'authenticated';
  mocks.user = {
    firstName: 'Jane',
    lastName: 'Doe',
    emailVerifiedAt: VERIFIED,
    onboardingIntent: null,
  };
});

describe('authenticated entry gates', () => {
  it.each(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/welcome'])(
    'routes a verified, not-onboarded visit to %s to role selection',
    async (pathname) => {
      mocks.pathname = pathname;
      render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
      await waitFor(() =>
        expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'),
      );
      expect(screen.queryByText('Public auth content')).toBeNull();
      expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    },
  );

  it('sends an onboarded supplier from an auth entry route to the dashboard', async () => {
    mocks.user = {
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerifiedAt: VERIFIED,
      onboardingIntent: 'ENTERPRISE',
    };
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it('sends an onboarded retailer to the dashboard route (its 404) and never back to onboarding', async () => {
    mocks.user = {
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerifiedAt: VERIFIED,
      onboardingIntent: 'RETAILER',
    };
    render(
      <RedirectAuthenticatedUser locationKey="/">
        <p>Landing</p>
      </RedirectAuthenticatedUser>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/role-selection');
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it('sends an authenticated but unverified account to verify email', async () => {
    mocks.user = {
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerifiedAt: null,
      onboardingIntent: null,
    };
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/verify-email'));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it('does not render logged-out content while the shared session is unresolved', () => {
    mocks.status = 'checking';
    mocks.user = null;
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">{child}</RedirectAuthenticatedUser>,
    );
    expect(screen.queryByText('Public auth content')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('shows public content for a confirmed signed-out session', () => {
    mocks.status = 'unauthenticated';
    mocks.user = null;
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">{child}</RedirectAuthenticatedUser>,
    );
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it.each(['/', '/auth/register', '/auth/register/account-details', '/auth/forgot-password'])(
    'never bounces a signed-out visitor from %s to login',
    (pathname) => {
      mocks.status = 'unauthenticated';
      mocks.user = null;
      mocks.pathname = pathname;
      render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
      expect(screen.getByText('Public auth content')).toBeTruthy();
      expect(mocks.router.replace).not.toHaveBeenCalled();
    },
  );

  it('keeps the verification callback on its account-mismatch flow', () => {
    mocks.pathname = '/auth/verify-email/confirm';
    mocks.status = 'unauthenticated';
    mocks.user = null;
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('keeps the check-your-email screen on its own session flow', () => {
    mocks.pathname = '/auth/verify-email';
    mocks.user = {
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerifiedAt: null,
      onboardingIntent: null,
    };
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('keeps role selection on its own authenticated role guard', () => {
    mocks.pathname = '/auth/role-selection';
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
