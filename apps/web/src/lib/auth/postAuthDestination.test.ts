import { beforeEach, describe, expect, it } from 'vitest';
import { clearOnboardingRole, writeOnboardingRole } from './flowState';
import { getPostAuthDestination } from './postAuthDestination';

beforeEach(() => {
  clearOnboardingRole();
});

describe('post-auth destination', () => {
  it('sends a new account to role selection when nothing is saved', () => {
    expect(getPostAuthDestination(null)).toBe('/auth/role-selection');
    expect(getPostAuthDestination(undefined)).toBe('/auth/role-selection');
    expect(getPostAuthDestination({ onboardingIntent: null })).toBe('/auth/role-selection');
  });

  it('prefers the onboarding intent saved on the account', () => {
    expect(getPostAuthDestination({ onboardingIntent: 'ENTERPRISE' })).toBe('/dashboard/overview');
    expect(getPostAuthDestination({ onboardingIntent: 'RETAILER' })).toBe('/dashboard/coming-soon');
    expect(getPostAuthDestination({ onboardingIntent: 'ENTREPRENEUR' })).toBe(
      '/dashboard/coming-soon',
    );
  });

  it('falls back to the role kept in this browser when the account has no intent', () => {
    writeOnboardingRole('supplier');
    expect(getPostAuthDestination({ onboardingIntent: null })).toBe('/dashboard/overview');
  });

  it('the account intent wins over a different local role', () => {
    writeOnboardingRole('retailer');
    expect(getPostAuthDestination({ onboardingIntent: 'ENTERPRISE' })).toBe('/dashboard/overview');
  });
});
