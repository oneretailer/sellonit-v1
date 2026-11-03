/**
 * sessionStorage-backed state for the multi-step code flows (forgot password,
 * and the verify-account step reached from login).
 *
 * sessionStorage is per browser tab and survives page refreshes. It has
 * nothing to do with a login session. Only the fields below are ever written:
 * never a password, a confirm password, the entered code, or a reset token.
 * The reset token lives in React memory (see the forgot-password layout).
 *
 * Every storage access is wrapped in try/catch. If storage is unavailable
 * (private mode, blocked by policy), the state is kept in a module variable
 * for the lifetime of the page instead. That variable is client-only, so it
 * is never shared between server requests.
 */
import { isAccountRole, type AccountRole } from '@/lib/onboarding/roles';
import type { IdentifierType } from './identifier';

export const AUTH_FLOW_STORAGE_KEY = 'auth_flow';
export const ONBOARDING_ROLE_STORAGE_KEY = 'sellonit_onboarding_role';
export const ONBOARDING_BUSINESS_STORAGE_KEY = 'sellonit_onboarding_business';

/**
 * The business details entered on the Create Business onboarding step. Kept in
 * the same sessionStorage-backed onboarding state as the role until the backend
 * business-creation contract is complete (see lib/onboarding/businessApi.ts).
 * Never holds credentials. `phone` is the normalized 11-digit local form and
 * `email` is trimmed/lowercased.
 */
export type OnboardingBusinessDraft = {
  name: string;
  phone: string;
  email: string;
  description: string;
  /** ISO timestamp of when the step was completed. */
  completedAt: string;
};

/** Resend cooldown after any successful send, in seconds. */
export const RESEND_COOLDOWN_SECONDS = 30;

export type AuthFlowPurpose = 'reset-password' | 'verify-account';

/** `verify`: the code step. `new-password`: the code was verified, the token is in memory. */
export type AuthFlowStep = 'verify' | 'new-password';

export type AuthFlowState = {
  step: AuthFlowStep;
  /** Normalized identifier (lowercased email, or `+234…` phone). */
  identifier: string;
  identifierType: IdentifierType;
  purpose: AuthFlowPurpose;
  /** Epoch milliseconds after which "Resend code" is enabled again, or null. */
  resendAvailableAt: number | null;
};

const STEPS: readonly AuthFlowStep[] = ['verify', 'new-password'];
const PURPOSES: readonly AuthFlowPurpose[] = ['reset-password', 'verify-account'];
const IDENTIFIER_TYPES: readonly IdentifierType[] = ['email', 'phone'];

/** Used only when sessionStorage cannot be used. Client-side only. */
let memoryFallback: AuthFlowState | null = null;
let onboardingRoleMemoryFallback: AccountRole | null = null;
const onboardingRoleListeners = new Set<() => void>();
let onboardingBusinessMemoryFallback: OnboardingBusinessDraft | null = null;
const onboardingBusinessListeners = new Set<() => void>();

export function subscribeOnboardingRole(listener: () => void): () => void {
  onboardingRoleListeners.add(listener);
  return () => onboardingRoleListeners.delete(listener);
}

function notifyOnboardingRoleListeners(): void {
  onboardingRoleListeners.forEach((listener) => listener());
}

/** Change listeners for React (see useStoredAuthFlow). */
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to saved-flow changes. Returns the unsubscribe function. */
export function subscribeAuthFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    // Access itself can throw (blocked storage).
    return null;
  }
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function isAuthFlowState(value: unknown): value is AuthFlowState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    STEPS.includes(candidate.step as AuthFlowStep) &&
    typeof candidate.identifier === 'string' &&
    candidate.identifier.length > 0 &&
    IDENTIFIER_TYPES.includes(candidate.identifierType as IdentifierType) &&
    PURPOSES.includes(candidate.purpose as AuthFlowPurpose) &&
    (candidate.resendAvailableAt === null || typeof candidate.resendAvailableAt === 'number')
  );
}

/** Copies only the known fields, so nothing else can ever be persisted. */
function toStoredState(state: AuthFlowState): AuthFlowState {
  return {
    step: state.step,
    identifier: state.identifier,
    identifierType: state.identifierType,
    purpose: state.purpose,
    resendAvailableAt: state.resendAvailableAt,
  };
}

function memoryRaw(): string | null {
  return hasWindow() && memoryFallback !== null ? JSON.stringify(memoryFallback) : null;
}

/**
 * The raw stored value, or null. A string, so React can compare snapshots by
 * value. Falls back to the memory copy when storage is unavailable or empty.
 */
export function readAuthFlowRaw(): string | null {
  const storage = browserStorage();
  if (storage === null) {
    return memoryRaw();
  }
  try {
    const raw = storage.getItem(AUTH_FLOW_STORAGE_KEY);
    if (raw !== null) {
      return raw;
    }
  } catch {
    // Read failed: use the memory copy below.
  }
  return memoryRaw();
}

/** Parses a raw value. Anything malformed or unexpected returns null. */
export function parseAuthFlow(raw: string | null): AuthFlowState | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAuthFlowState(parsed) ? toStoredState(parsed) : null;
  } catch {
    return null;
  }
}

/** The saved flow, or null when there is none (or it is unreadable). */
export function readAuthFlow(): AuthFlowState | null {
  const raw = readAuthFlowRaw();
  const parsed = parseAuthFlow(raw);
  if (raw !== null && parsed === null) {
    // Unreadable or tampered value: drop it so guards send the user to the start.
    clearAuthFlow();
  }
  return parsed;
}

export function writeAuthFlow(state: AuthFlowState): AuthFlowState {
  const stored = toStoredState(state);
  memoryFallback = hasWindow() ? stored : null;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Quota or access error: the memory copy above still carries the flow.
    }
  }
  notify();
  return stored;
}

/** Merges `changes` into the saved flow. Returns the new state, or null if there is none. */
export function patchAuthFlow(changes: Partial<AuthFlowState>): AuthFlowState | null {
  const current = readAuthFlow();
  if (current === null) {
    return null;
  }
  return writeAuthFlow({ ...current, ...changes });
}

export function clearAuthFlow(): void {
  memoryFallback = null;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.removeItem(AUTH_FLOW_STORAGE_KEY);
    } catch {
      // Nothing else to clean up; the memory copy is already cleared.
    }
  }
  notify();
}

/** Epoch ms for "now + the resend cooldown". */
export function resendAvailableAfterSend(now: number = Date.now()): number {
  return now + RESEND_COOLDOWN_SECONDS * 1000;
}

/** Stores only the onboarding role ID so selection can be restored on Back or refresh. */
export function writeOnboardingRole(role: AccountRole): AccountRole {
  onboardingRoleMemoryFallback = role;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.setItem(ONBOARDING_ROLE_STORAGE_KEY, role);
    } catch {
      // Keep the in-memory selection available if browser storage is blocked.
    }
  }
  notifyOnboardingRoleListeners();
  return role;
}

export function readOnboardingRole(): AccountRole | null {
  const storage = browserStorage();
  if (storage !== null) {
    try {
      const storedRole = storage.getItem(ONBOARDING_ROLE_STORAGE_KEY);
      if (storedRole === null) return onboardingRoleMemoryFallback;
      if (isAccountRole(storedRole)) {
        onboardingRoleMemoryFallback = storedRole;
        return storedRole;
      }
      storage.removeItem(ONBOARDING_ROLE_STORAGE_KEY);
      onboardingRoleMemoryFallback = null;
      return null;
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return onboardingRoleMemoryFallback;
}

export function clearOnboardingRole(): void {
  onboardingRoleMemoryFallback = null;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.removeItem(ONBOARDING_ROLE_STORAGE_KEY);
    } catch {
      // Nothing else to clear.
    }
  }
  notifyOnboardingRoleListeners();
}

/* ── Onboarding business draft (Create Business step) ─────────────────────── */

export function subscribeOnboardingBusiness(listener: () => void): () => void {
  onboardingBusinessListeners.add(listener);
  return () => {
    onboardingBusinessListeners.delete(listener);
  };
}

function notifyOnboardingBusinessListeners(): void {
  onboardingBusinessListeners.forEach((listener) => listener());
}

function isOnboardingBusinessDraft(value: unknown): value is OnboardingBusinessDraft {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.phone === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.completedAt === 'string'
  );
}

/** Copies only the known fields so nothing else can ever be persisted. */
function toStoredBusiness(draft: OnboardingBusinessDraft): OnboardingBusinessDraft {
  return {
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
    description: draft.description,
    completedAt: draft.completedAt,
  };
}

function businessMemoryRaw(): string | null {
  return hasWindow() && onboardingBusinessMemoryFallback !== null
    ? JSON.stringify(onboardingBusinessMemoryFallback)
    : null;
}

/**
 * The raw stored value (a string, so React can compare snapshots by value), or
 * null. Falls back to the memory copy when storage is unavailable or empty.
 */
export function readOnboardingBusinessRaw(): string | null {
  const storage = browserStorage();
  if (storage === null) return businessMemoryRaw();
  try {
    const raw = storage.getItem(ONBOARDING_BUSINESS_STORAGE_KEY);
    if (raw !== null) return raw;
  } catch {
    // Read failed: use the memory copy below.
  }
  return businessMemoryRaw();
}

/** Parses a raw value. Anything malformed or unexpected returns null. */
export function parseOnboardingBusiness(raw: string | null): OnboardingBusinessDraft | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOnboardingBusinessDraft(parsed) ? toStoredBusiness(parsed) : null;
  } catch {
    return null;
  }
}

/** The saved business draft, or null when there is none (or it is unreadable). */
export function readOnboardingBusiness(): OnboardingBusinessDraft | null {
  const raw = readOnboardingBusinessRaw();
  const parsed = parseOnboardingBusiness(raw);
  if (raw !== null && parsed === null) {
    clearOnboardingBusiness();
  }
  return parsed;
}

export function writeOnboardingBusiness(draft: OnboardingBusinessDraft): OnboardingBusinessDraft {
  const stored = toStoredBusiness(draft);
  onboardingBusinessMemoryFallback = hasWindow() ? stored : null;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.setItem(ONBOARDING_BUSINESS_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Quota or access error: the memory copy above still carries the draft.
    }
  }
  notifyOnboardingBusinessListeners();
  return stored;
}

export function clearOnboardingBusiness(): void {
  onboardingBusinessMemoryFallback = null;
  const storage = browserStorage();
  if (storage !== null) {
    try {
      storage.removeItem(ONBOARDING_BUSINESS_STORAGE_KEY);
    } catch {
      // Nothing else to clear.
    }
  }
  notifyOnboardingBusinessListeners();
}
