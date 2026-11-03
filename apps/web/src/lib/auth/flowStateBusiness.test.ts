/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONBOARDING_BUSINESS_STORAGE_KEY,
  clearOnboardingBusiness,
  parseOnboardingBusiness,
  readOnboardingBusiness,
  readOnboardingBusinessRaw,
  subscribeOnboardingBusiness,
  writeOnboardingBusiness,
} from './flowState';

const draft = {
  name: 'Okechukwu Fashion',
  phone: '08031234567',
  email: 'hello@example.com',
  description: 'Fashion retailer',
  completedAt: '2026-10-26T00:00:00.000Z',
};

beforeEach(() => {
  sessionStorage.clear();
  clearOnboardingBusiness();
});

describe('onboarding business draft state', () => {
  it('round-trips through sessionStorage and returns a stable raw snapshot', () => {
    expect(readOnboardingBusiness()).toBeNull();
    writeOnboardingBusiness(draft);
    expect(sessionStorage.getItem(ONBOARDING_BUSINESS_STORAGE_KEY)).not.toBeNull();
    expect(readOnboardingBusiness()).toEqual(draft);
    // Raw snapshot is a string so useSyncExternalStore can compare by value.
    const raw = readOnboardingBusinessRaw();
    expect(typeof raw).toBe('string');
    expect(readOnboardingBusinessRaw()).toBe(raw);
  });

  it('notifies subscribers on write and clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOnboardingBusiness(listener);
    writeOnboardingBusiness(draft);
    expect(listener).toHaveBeenCalledTimes(1);
    clearOnboardingBusiness();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(readOnboardingBusiness()).toBeNull();
    unsubscribe();
    writeOnboardingBusiness(draft);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed or tampered stored values', () => {
    expect(parseOnboardingBusiness(null)).toBeNull();
    expect(parseOnboardingBusiness('not json')).toBeNull();
    expect(parseOnboardingBusiness(JSON.stringify({ name: '' }))).toBeNull();
    expect(parseOnboardingBusiness(JSON.stringify({ ...draft, phone: 123 }))).toBeNull();
    expect(parseOnboardingBusiness(JSON.stringify(draft))).toEqual(draft);

    sessionStorage.setItem(ONBOARDING_BUSINESS_STORAGE_KEY, '{bad');
    // An unreadable value is dropped, not surfaced.
    expect(readOnboardingBusiness()).toBeNull();
    expect(sessionStorage.getItem(ONBOARDING_BUSINESS_STORAGE_KEY)).toBeNull();
  });
});
