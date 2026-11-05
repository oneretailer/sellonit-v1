/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_SIGNAL_CHANNEL_NAME, AUTH_SIGNAL_STORAGE_KEY, broadcastSignupCompleted, parseAuthSignal, subscribeAuthSignals } from './crossTab';
import { broadcastEmailVerified, subscribeEmailVerified, VERIFICATION_CHANNEL_NAME, VERIFICATION_STORAGE_KEY } from './verificationSignal';

class FakeChannel {
  static instances: FakeChannel[] = [];
  static blocked = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  closed = false;
  constructor(public name: string) { if (FakeChannel.blocked) throw new Error('blocked'); FakeChannel.instances.push(this); }
  postMessage(data: unknown) { for (const other of FakeChannel.instances) if (other !== this && !other.closed && other.name === this.name) other.onmessage?.(new MessageEvent('message', { data })); }
  close() { this.closed = true; }
}
beforeEach(() => { localStorage.clear(); FakeChannel.instances = []; FakeChannel.blocked = false; vi.stubGlobal('BroadcastChannel', FakeChannel); });
afterEach(() => { vi.unstubAllGlobals(); });
describe('one typed cross-tab transport', () => {
  it('preserves the verification channel and storage key', () => { expect(VERIFICATION_CHANNEL_NAME).toBe(AUTH_SIGNAL_CHANNEL_NAME); expect(VERIFICATION_STORAGE_KEY).toBe(AUTH_SIGNAL_STORAGE_KEY); });
  it('sends and receives signup completion without personal data', () => {
    const listener = vi.fn(); const unsubscribe = subscribeAuthSignals(listener);
    broadcastSignupCompleted('supplier', 123);
    expect(listener).toHaveBeenCalledWith({ type: 'SIGNUP_COMPLETED', accountType: 'supplier', at: 123 });
    expect(localStorage.getItem(AUTH_SIGNAL_STORAGE_KEY)).toBe('{"type":"SIGNUP_COMPLETED","at":123,"accountType":"supplier"}');
    unsubscribe(); expect(FakeChannel.instances.every((channel) => channel.closed)).toBe(true);
  });
  it('deduplicates channel/storage delivery', () => {
    const listener = vi.fn(); const unsubscribe = subscribeAuthSignals(listener); const signal = { type: 'SIGNUP_COMPLETED', at: 123, accountType: 'supplier' };
    broadcastSignupCompleted('supplier', 123); window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_STORAGE_KEY, newValue: JSON.stringify(signal) }));
    expect(listener).toHaveBeenCalledTimes(1); unsubscribe();
  });
  it('falls back to storage when BroadcastChannel is blocked', () => {
    FakeChannel.blocked = true; const listener = vi.fn(); const unsubscribe = subscribeAuthSignals(listener); broadcastSignupCompleted('retailer', 456);
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_STORAGE_KEY, newValue: localStorage.getItem(AUTH_SIGNAL_STORAGE_KEY) }));
    expect(listener).toHaveBeenCalledWith({ type: 'SIGNUP_COMPLETED', at: 456, accountType: 'retailer' }); unsubscribe();
  });
  it('preserves verified listeners and ignores signup messages for them', () => {
    const verified = vi.fn(); const all = vi.fn(); const a = subscribeEmailVerified(verified); const b = subscribeAuthSignals(all);
    broadcastEmailVerified(123); broadcastSignupCompleted('supplier', 456);
    expect(verified).toHaveBeenCalledTimes(1); expect(all).toHaveBeenCalledTimes(2); a(); b();
  });
  it.each([null, {}, 'hello', { type: 'SIGNUP_COMPLETED', at: 1 }, { type: 'SIGNUP_COMPLETED', at: 1, accountType: 'OWNER' }, { type: 'email-verified', at: Infinity }, { type: 'email-verified', at: -1 }])('rejects unknown/malformed signal %j', (value) => expect(parseAuthSignal(value)).toBeNull());
  it('whitelists extra fields instead of forwarding secrets', () => { expect(parseAuthSignal({ type: 'email-verified', at: 1, token: 'secret', email: 'a@b.c' })).toEqual({ type: 'email-verified', at: 1 }); });
  it('cleans up every listener/channel under StrictMode-style repeated setup', () => {
    const remove = vi.spyOn(window, 'removeEventListener'); const listener = vi.fn();
    const first = subscribeAuthSignals(listener); first(); const second = subscribeAuthSignals(listener); second();
    expect(FakeChannel.instances.every((channel) => channel.closed)).toBe(true); expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
    broadcastSignupCompleted('supplier'); expect(listener).not.toHaveBeenCalled();
  });
  it('ignores malformed and unrelated storage events', () => {
    const listener = vi.fn(); const unsubscribe = subscribeAuthSignals(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '{}' }));
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_STORAGE_KEY, newValue: '{bad' }));
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_STORAGE_KEY, newValue: null }));
    expect(listener).not.toHaveBeenCalled(); unsubscribe();
  });
});
