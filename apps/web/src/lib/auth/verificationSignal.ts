/** Compatibility facade for existing verification consumers; transport lives in crossTab.ts. */
import { AUTH_SIGNAL_CHANNEL_NAME, AUTH_SIGNAL_STORAGE_KEY, sendAuthSignal, subscribeAuthSignals } from './crossTab';
export const VERIFICATION_CHANNEL_NAME = AUTH_SIGNAL_CHANNEL_NAME;
export const VERIFICATION_STORAGE_KEY = AUTH_SIGNAL_STORAGE_KEY;
export type VerificationSignal = { type: 'email-verified'; at: number };
export function broadcastEmailVerified(now: number = Date.now()): void { sendAuthSignal({ type: 'email-verified', at: now }); }
export function subscribeEmailVerified(listener: () => void): () => void { return subscribeAuthSignals((signal) => { if (signal.type === 'email-verified') listener(); }); }
