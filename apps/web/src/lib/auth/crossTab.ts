/** ONE typed signal transport, retaining the original verification channel/key. */
import type { AccountRole } from '@/lib/onboarding/roles';
import { isAccountRole } from '@/lib/onboarding/roles';

export const AUTH_SIGNAL_CHANNEL_NAME = 'sellonit.auth.verification';
export const AUTH_SIGNAL_STORAGE_KEY = 'sellonit.auth.verification-signal';
export type AuthCrossTabMessage =
  | { type: 'email-verified'; at: number }
  | { type: 'SIGNUP_COMPLETED'; at: number; accountType: AccountRole };

/** Whitelist parsing: never accept/pass through tokens, email, phone or arbitrary fields. */
export function parseAuthSignal(value: unknown): AuthCrossTabMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.at !== 'number' || !Number.isFinite(candidate.at) || candidate.at < 0) return null;
  if (candidate.type === 'email-verified') return { type: 'email-verified', at: candidate.at };
  if (candidate.type === 'SIGNUP_COMPLETED' && isAccountRole(candidate.accountType)) return { type: 'SIGNUP_COMPLETED', at: candidate.at, accountType: candidate.accountType };
  return null;
}
function serialize(signal: AuthCrossTabMessage): string {
  // Explicit fields prevent accidental expansion into sensitive data.
  return JSON.stringify(signal.type === 'email-verified' ? { type: signal.type, at: signal.at } : { type: signal.type, at: signal.at, accountType: signal.accountType });
}
export function sendAuthSignal(signal: AuthCrossTabMessage): void {
  if (typeof window === 'undefined') return;
  const raw = serialize(signal);
  try { const channel = new BroadcastChannel(AUTH_SIGNAL_CHANNEL_NAME); channel.postMessage(JSON.parse(raw) as unknown); channel.close(); } catch { /* Storage fallback below. */ }
  try { window.localStorage.setItem(AUTH_SIGNAL_STORAGE_KEY, raw); } catch { /* Focus/server rechecks remain available. */ }
}
export function subscribeAuthSignals(listener: (signal: AuthCrossTabMessage) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let closed = false; let channel: BroadcastChannel | null = null;
  const seen = new Set<string>();
  function receive(value: unknown) {
    if (closed) return;
    const signal = parseAuthSignal(value); if (!signal) return;
    const key = serialize(signal); if (seen.has(key)) return; seen.add(key);
    // Bound deduplication memory in a long-lived onboarding tab.
    if (seen.size > 50) { const oldest = seen.values().next().value; if (oldest) seen.delete(oldest); }
    listener(signal);
  }
  try { channel = new BroadcastChannel(AUTH_SIGNAL_CHANNEL_NAME); channel.onmessage = (event: MessageEvent<unknown>) => receive(event.data); } catch { channel = null; }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SIGNAL_STORAGE_KEY || event.newValue === null) return;
    try { receive(JSON.parse(event.newValue) as unknown); } catch { /* Ignore malformed storage. */ }
  };
  window.addEventListener('storage', onStorage);
  return () => { closed = true; window.removeEventListener('storage', onStorage); try { channel?.close(); } catch { /* Already closed/blocked. */ } channel = null; };
}
export function broadcastSignupCompleted(accountType: AccountRole, now = Date.now()): void { sendAuthSignal({ type: 'SIGNUP_COMPLETED', at: now, accountType }); }
