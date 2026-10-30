import { describe, expect, it } from 'vitest';
import { AUTH_ROUTE, redirectTarget, resolveAuthDestination } from './authDestination';

const VERIFIED = '2026-10-26T00:00:00.000Z';

describe('resolveAuthDestination — the one routing decision', () => {
  it.each(['checking', 'error'] as const)('is unresolved while the session is %s', (status) => {
    expect(resolveAuthDestination({ status, user: null })).toEqual({
      kind: 'loading',
      path: null,
    });
  });

  it('never guesses a destination for an authenticated status without a user', () => {
    expect(resolveAuthDestination({ status: 'authenticated', user: null })).toEqual({
      kind: 'loading',
      path: null,
    });
  });

  it('sends a signed-out visitor to login', () => {
    expect(resolveAuthDestination({ status: 'unauthenticated', user: null })).toEqual({
      kind: 'login',
      path: AUTH_ROUTE.login,
    });
  });

  it('sends an unverified account to verify email', () => {
    expect(
      resolveAuthDestination({
        status: 'authenticated',
        user: { emailVerifiedAt: null, onboardingIntent: null },
      }),
    ).toEqual({ kind: 'verify-email', path: AUTH_ROUTE.verifyEmail });
  });

  it('sends a verified account with no onboarding choice to role selection', () => {
    expect(
      resolveAuthDestination({
        status: 'authenticated',
        user: { emailVerifiedAt: VERIFIED, onboardingIntent: null },
      }),
    ).toEqual({ kind: 'role-selection', path: AUTH_ROUTE.roleSelection });
  });

  it.each(['ENTERPRISE', 'RETAILER', 'ENTREPRENEUR'] as const)(
    'sends an onboarded %s account to the dashboard entry point',
    (onboardingIntent) => {
      expect(
        resolveAuthDestination({
          status: 'authenticated',
          user: { emailVerifiedAt: VERIFIED, onboardingIntent },
        }),
      ).toEqual({ kind: 'dashboard', path: AUTH_ROUTE.dashboard });
    },
  );

  it('is pure: the same session always resolves to the same single destination', () => {
    const session = {
      status: 'authenticated' as const,
      user: { emailVerifiedAt: VERIFIED, onboardingIntent: 'ENTERPRISE' as const },
    };
    const first = resolveAuthDestination(session);
    const second = resolveAuthDestination(session);
    expect(second).toEqual(first);
    expect(first.path).toBe('/dashboard/overview');
  });
});

describe('redirectTarget — loop-proof redirects', () => {
  it('never returns the page it was asked about', () => {
    expect(
      redirectTarget(
        { kind: 'role-selection', path: '/auth/role-selection' },
        '/auth/role-selection',
      ),
    ).toBeNull();
    expect(redirectTarget({ kind: 'login', path: '/auth/login' }, '/auth/login')).toBeNull();
    expect(
      redirectTarget({ kind: 'verify-email', path: '/auth/verify-email' }, '/auth/verify-email'),
    ).toBeNull();
    expect(
      redirectTarget({ kind: 'dashboard', path: '/dashboard/overview' }, '/dashboard/overview'),
    ).toBeNull();
  });

  it('treats the whole dashboard as one destination family', () => {
    expect(
      redirectTarget({ kind: 'dashboard', path: '/dashboard/overview' }, '/dashboard/products'),
    ).toBeNull();
  });

  it('does not treat a look-alike path as the dashboard', () => {
    expect(
      redirectTarget({ kind: 'dashboard', path: '/dashboard/overview' }, '/dashboardish'),
    ).toBe('/dashboard/overview');
  });

  it('returns the destination for every other page', () => {
    expect(redirectTarget({ kind: 'login', path: '/auth/login' }, '/auth/register')).toBe(
      '/auth/login',
    );
    expect(
      redirectTarget(
        { kind: 'role-selection', path: '/auth/role-selection' },
        '/auth/verify-email',
      ),
    ).toBe('/auth/role-selection');
    expect(
      redirectTarget(
        { kind: 'verify-email', path: '/auth/verify-email' },
        '/auth/verify-email/confirm',
      ),
    ).toBe('/auth/verify-email');
  });

  it('has nothing to redirect to while the session is loading', () => {
    expect(redirectTarget({ kind: 'loading', path: null }, '/auth/login')).toBeNull();
  });
});
