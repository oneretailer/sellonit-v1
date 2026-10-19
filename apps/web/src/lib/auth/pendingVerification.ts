/**
 * Holds the pending verification email across the register → verify-email
 * navigation. Only the email is stored (sessionStorage, cleared on demand);
 * passwords are never stored, logged, or put in URLs.
 */

export const PENDING_VERIFICATION_EMAIL_KEY = 'sellonit.pendingVerificationEmail';

export function setPendingVerificationEmail(email: string): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email);
  }
}

export function getPendingVerificationEmail(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
}

export function clearPendingVerificationEmail(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
  }
}
