import { beforeEach, describe, expect, it } from 'vitest';
import { clearOnboardingRole, writeOnboardingRole } from './flowState';
import { getPostAuthDestination } from './postAuthDestination';

const VERIFIED = '2026-10-26T00:00:00.000Z';

beforeEach(() => {
  clearOnboardingRole();
});

describe('post-auth destination', () => {
  it('sends a verified account without a saved choice to role selection', () => {
    expect(getPostAuthDestination({ emailVerifiedAt: VERIFIED, onboardingIntent: null })).toBe(
      '/auth/role-selection',
    );
  });

  it('sends an unverified account back to the verify-email step', () => {
    expect(getPostAuthDestination({ emailVerifiedAt: null, onboardingIntent: null })).toBe(
      '/auth/verify-email',
    );
  });

  it.each(['ENTERPRISE', 'RETAILER', 'ENTREPRENEUR'] as const)(
    'sends an onboarded account (%s) to the dashboard route exactly once',
    (onboardingIntent) => {
      // Every onboarded role resolves to the same entry point; the dashboard
      // route decides whether that role has a workspace (only Supplier does).
      expect(getPostAuthDestination({ emailVerifiedAt: VERIFIED, onboardingIntent })).toBe(
        '/dashboard/overview',
      );
    },
  );

  it('never consults the role remembered in this browser', () => {
    writeOnboardingRole('supplier');
    expect(getPostAuthDestination({ emailVerifiedAt: VERIFIED, onboardingIntent: null })).toBe(
      '/auth/role-selection',
    );
  });

  it('falls back to login when there is no user', () => {
    expect(getPostAuthDestination(null)).toBe('/auth/login');
    expect(getPostAuthDestination(undefined)).toBe('/auth/login');
  });
});
