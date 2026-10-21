/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api-client';
import { AuthenticatedAuthRouteGate } from './AuthenticatedAuthRouteGate';
import { RedirectAuthenticatedUser } from './RedirectAuthenticatedUser';
import { clearOnboardingRole, writeOnboardingRole } from '@/lib/auth/flowState';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  getMe: vi.fn(),
  pathname: '/auth/login',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));
vi.mock('@/lib/auth/api', () => ({ getMe: mocks.getMe }));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingRole();
  mocks.pathname = '/auth/login';
  mocks.getMe.mockResolvedValue({ data: { email: 'jane@example.com' } });
});

const child = <p>Public auth content</p>;

describe('authenticated entry gates', () => {
  it.each(['/auth/login', '/auth/register', '/auth/forgot-password'])(
    'routes an authenticated visit to %s through the shared onboarding gate',
    async (pathname) => {
      mocks.pathname = pathname;
      render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
      await waitFor(() =>
        expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'),
      );
    },
  );

  it('routes an authenticated landing visit with no saved role to role selection', async () => {
    render(
      <RedirectAuthenticatedUser locationKey="/">
        <p>Signup chooser</p>
      </RedirectAuthenticatedUser>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
  });

  it('uses the saved role recommendation for authenticated visitors to public entry routes', async () => {
    writeOnboardingRole('retailer');
    render(
      <RedirectAuthenticatedUser locationKey="/">
        <p>Signup chooser</p>
      </RedirectAuthenticatedUser>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/account'));
  });

  it('does not gate the verification callback route, which has its own account-mismatch check', () => {
    mocks.pathname = '/auth/verify-email/confirm';
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('does not route around the guarded onboarding success and role routes', () => {
    mocks.pathname = '/auth/role-selection';
    render(<AuthenticatedAuthRouteGate>{child}</AuthenticatedAuthRouteGate>);
    expect(screen.getByText('Public auth content')).toBeTruthy();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('retries a transient 401 once so a newly established session is not bounced to Login', async () => {
    mocks.getMe
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Cookie not visible yet'))
      .mockResolvedValueOnce({ data: { email: 'jane@example.com' } });
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">
        <p>Login form</p>
      </RedirectAuthenticatedUser>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/login');
    expect(mocks.getMe).toHaveBeenCalledTimes(2);
  });

  it('leaves unauthenticated and unavailable sessions on the public route', async () => {
    mocks.getMe
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Not signed in'))
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Not signed in'));
    render(
      <RedirectAuthenticatedUser locationKey="/auth/login">
        <p>Login form</p>
      </RedirectAuthenticatedUser>,
    );
    expect(await screen.findByText('Login form')).toBeTruthy();
    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledTimes(2));
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
