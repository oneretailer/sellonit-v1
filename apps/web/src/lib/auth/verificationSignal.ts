/**
 * Cross-tab signal for "this browser just verified its email".
 *
 * The verification link can be opened in another tab of the same browser, so
 * the check-your-email tab can be told instantly instead of waiting for its
 * next `/auth/me` poll. A different browser/device cannot be signalled this way
 * (there is no public verification-status endpoint yet — see the report).
 *
 * BroadcastChannel is used where available; a localStorage write is the
 * fallback (`storage` events reach other tabs). Both are wrapped in try/catch
 * because storage and BroadcastChannel can be blocked.
 */
export const VERIFICATION_CHANNEL_NAME = 'sellonit.auth.verification';
export const VERIFICATION_STORAGE_KEY = 'sellonit.auth.verification-signal';

export type VerificationSignal = { type: 'email-verified'; at: number };

function parseSignal(value: unknown): VerificationSignal | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== 'email-verified' || typeof candidate.at !== 'number') return null;
  return { type: 'email-verified', at: candidate.at };
}

/** Tells other tabs of this browser that the email is verified now. */
export function broadcastEmailVerified(now: number = Date.now()): void {
  const signal: VerificationSignal = { type: 'email-verified', at: now };
  if (typeof window === 'undefined') return;
  try {
    const channel = new BroadcastChannel(VERIFICATION_CHANNEL_NAME);
    channel.postMessage(signal);
    channel.close();
  } catch {
    // BroadcastChannel unsupported or blocked: the storage event below covers it.
  }
  try {
    window.localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(signal));
  } catch {
    // Storage blocked: other tabs will fall back to polling.
  }
}

/**
 * Calls `listener` when another tab reports a successful verification.
 * Returns the unsubscribe function.
 */
export function subscribeEmailVerified(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(VERIFICATION_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (parseSignal(event.data)) listener();
    };
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== VERIFICATION_STORAGE_KEY) return;
    if (event.newValue === null) return;
    try {
      if (parseSignal(JSON.parse(event.newValue) as unknown)) listener();
    } catch {
      // Ignore a malformed value; polling remains the safety net.
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('storage', onStorage);
    try {
      channel?.close();
    } catch {
      // Nothing to clean up.
    }
  };
}
