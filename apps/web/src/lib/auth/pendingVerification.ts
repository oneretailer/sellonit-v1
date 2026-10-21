/**
 * Stores only the email needed to recover the check-your-email screen. The
 * password is never persisted. localStorage survives refreshes and new tabs in
 * this browser; it does not share state with a different browser.
 */

export const PENDING_VERIFICATION_EMAIL_KEY = 'sellonit.pendingVerificationEmail';
export const PENDING_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type PendingVerificationRecord = {
  email: string;
  expiresAt: number;
};

const listeners = new Set<() => void>();

export function subscribePendingVerificationEmail(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function setPendingVerificationEmail(email: string, now = Date.now()): void {
  const localStorage = storage();
  if (!localStorage) return;

  const record: PendingVerificationRecord = {
    email,
    expiresAt: now + PENDING_VERIFICATION_TTL_MS,
  };
  try {
    localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, JSON.stringify(record));
    notifyListeners();
  } catch {
    // Storage can be unavailable or full; the page still has its live email state.
  }
}

export function getPendingVerificationEmail(now = Date.now()): string | null {
  const localStorage = storage();
  if (!localStorage) return null;

  try {
    const stored = localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'email' in parsed &&
      'expiresAt' in parsed &&
      typeof parsed.email === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > now
    ) {
      return parsed.email;
    }
    localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
  } catch {
    try {
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }
  return null;
}

export function clearPendingVerificationEmail(): void {
  const localStorage = storage();
  if (localStorage) {
    try {
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    } catch {
      // Clear the legacy tab-scoped value too, if available.
    }
  }
  notifyListeners();
}
