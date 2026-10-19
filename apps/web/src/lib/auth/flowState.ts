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
import type { IdentifierType } from './identifier';

export const AUTH_FLOW_STORAGE_KEY = 'auth_flow';

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
