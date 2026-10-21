/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  PENDING_VERIFICATION_EMAIL_KEY,
  PENDING_VERIFICATION_TTL_MS,
  setPendingVerificationEmail,
} from './pendingVerification';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('pending verification email persistence', () => {
  it('persists only the email with a 24-hour expiry and restores it after remount', () => {
    setPendingVerificationEmail('jane@example.com', 1_800_000_000_000);
    const stored = localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({
      email: 'jane@example.com',
      expiresAt: 1_800_000_000_000 + PENDING_VERIFICATION_TTL_MS,
    });
    expect(stored).not.toContain('password');
    expect(getPendingVerificationEmail(1_800_000_000_001)).toBe('jane@example.com');
  });

  it('expires and removes stale or malformed pending records', () => {
    setPendingVerificationEmail('jane@example.com', 1_800_000_000_000);
    expect(getPendingVerificationEmail(1_800_000_000_000 + PENDING_VERIFICATION_TTL_MS)).toBeNull();
    expect(localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();

    localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, 'not-json');
    expect(getPendingVerificationEmail()).toBeNull();
    expect(localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();
  });

  it('clears both the durable record and the legacy tab-scoped record', () => {
    setPendingVerificationEmail('jane@example.com');
    sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, 'jane@example.com');
    clearPendingVerificationEmail();
    expect(localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();
    expect(sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();
  });
});
