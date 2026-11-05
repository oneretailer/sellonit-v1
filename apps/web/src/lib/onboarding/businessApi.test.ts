/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOnboardingBusiness,
  ONBOARDING_BUSINESS_STORAGE_KEY,
  readOnboardingBusiness,
} from '@/lib/auth/flowState';
import {
  NON_SUPPLIER_BUSINESS_CREATION_ENABLED,
  businessApi,
  canCreateBusiness,
  localBusinessApi,
  httpBusinessApi,
} from './businessApi';

beforeEach(() => {
  sessionStorage.clear();
  clearOnboardingBusiness();
});

describe('business creation feature flag', () => {
  it('only lets the supplier track advance while the flag is off', () => {
    expect(NON_SUPPLIER_BUSINESS_CREATION_ENABLED).toBe(false);
    expect(canCreateBusiness('supplier')).toBe(true);
    expect(canCreateBusiness('retailer')).toBe(false);
    expect(canCreateBusiness('entrepreneur')).toBe(false);
    expect(canCreateBusiness(null)).toBe(false);
  });

  it('selects the typed HTTP adapter; local business drafts are not server membership', () => {
    expect(businessApi).toBe(httpBusinessApi);
    expect(businessApi).not.toBe(localBusinessApi);
  });
});

describe('local business adapter', () => {
  it('stores the details in the shared onboarding state and resolves a business', async () => {
    const created = await localBusinessApi.createBusiness({
      name: '  Okechukwu Fashion  ',
      phone: '08031234567',
      email: 'Hello@Example.com',
      description: '  Fashion retailer  ',
      role: 'supplier',
    });

    expect(created.name).toBe('Okechukwu Fashion');
    expect(created.type).toBe('ENTERPRISE');
    expect(created.id).toBeTruthy();

    // Persisted in the same sessionStorage-backed onboarding state as the role.
    expect(sessionStorage.getItem(ONBOARDING_BUSINESS_STORAGE_KEY)).not.toBeNull();
    const draft = readOnboardingBusiness();
    expect(draft?.name).toBe('Okechukwu Fashion');
    expect(draft?.phone).toBe('08031234567');
    expect(draft?.email).toBe('Hello@Example.com');
    expect(draft?.description).toBe('Fashion retailer');
    expect(draft?.completedAt).toBeTruthy();
  });
});
