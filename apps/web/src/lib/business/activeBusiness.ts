/**
 * Active-business transport scope.
 *
 * TODO(backend): confirm how the API expects the active business to be sent
 * (header vs path). Until then the Products module sends `X-Business-Id` on
 * every same-origin request. This module is the ONE place that changes when
 * the contract is confirmed. The value is a display/routing hint only; the
 * server must still authorize membership.
 */

export const ACTIVE_BUSINESS_STORAGE_KEY = 'sellonit.active-business';
export const ACTIVE_BUSINESS_HEADER = 'X-Business-Id';

let activeBusinessId: string | null = null;

export function readStoredActiveBusinessId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getActiveBusinessId(): string | null {
  return activeBusinessId ?? readStoredActiveBusinessId();
}

export function setActiveBusinessId(id: string | null): void {
  activeBusinessId = id;
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY);
  } catch {
    // In-memory scope still applies when storage is blocked.
  }
}
