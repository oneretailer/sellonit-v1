/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RequireAuthenticatedSession } from './RequireAuthenticatedSession';

const VERIFIED = '2026-10-26T00:00:00.000Z';

type SessionUser = {
  emailVerifiedAt: string | null;
  onboardingIntent: string | null;
};

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  pathname: '/auth/create-business',
  status: 'authenticated',
  user: null as SessionUser | null,
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
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    status: mocks.status,
    user: mocks.user,
    refreshSession: mocks.refreshSession,
  }),
}));

const child = <p>Create business form</p>;

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/auth/create-business';
  mocks.status = 'authenticated';
  mocks.user = { emailVerifiedAt: VERIFIED, onboardingIntent: 'ENTERPRISE' };
});

describe('RequireAuthenticatedSession allowOnboarded (Create Business)', () => {
  it('renders for an onboarded user instead of bouncing them to the dashboard', () => {
    render(<RequireAuthenticatedSession allowOnboarded>{child}</RequireAuthenticatedSession>);
    expect(screen.getByText('Create business form')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('still redirects an onboarded user away when allowOnboarded is off (role-selection guard)', () => {
    mocks.pathname = '/auth/role-selection';
    render(<RequireAuthenticatedSession>{child}</RequireAuthenticatedSession>);
    expect(screen.queryByText('Create business form')).toBeNull();
    return waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
  });

  it('redirects an unauthenticated visitor to login', () => {
    mocks.status = 'unauthenticated';
    mocks.user = null;
    render(<RequireAuthenticatedSession allowOnboarded>{child}</RequireAuthenticatedSession>);
    expect(screen.queryByText('Create business form')).toBeNull();
    return waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
  });

  it('redirects an unverified visitor to verify-email', () => {
    mocks.user = { emailVerifiedAt: null, onboardingIntent: null };
    render(<RequireAuthenticatedSession allowOnboarded>{child}</RequireAuthenticatedSession>);
    expect(screen.queryByText('Create business form')).toBeNull();
    return waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/verify-email'));
  });

  it('sends a visitor who has not chosen a role back to role selection', () => {
    mocks.user = { emailVerifiedAt: VERIFIED, onboardingIntent: null };
    render(<RequireAuthenticatedSession allowOnboarded>{child}</RequireAuthenticatedSession>);
    expect(screen.queryByText('Create business form')).toBeNull();
    return waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
  });
});
