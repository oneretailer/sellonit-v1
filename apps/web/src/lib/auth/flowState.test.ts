import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_FLOW_STORAGE_KEY,
  clearAuthFlow,
  patchAuthFlow,
  readAuthFlow,
  writeAuthFlow,
  type AuthFlowState,
} from './flowState';

/** Minimal in-memory sessionStorage stand-in. */
function fakeStorage(options: { throwOnWrite?: boolean } = {}) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options.throwOnWrite) {
        throw new Error('quota');
      }
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const sample: AuthFlowState = {
  step: 'verify',
  identifier: 'jane@example.com',
  identifierType: 'email',
  purpose: 'reset-password',
  resendAvailableAt: 1_700_000_030_000,
};

function stubWindow(storage: unknown) {
  vi.stubGlobal('window', { sessionStorage: storage });
}

describe('flowState with sessionStorage', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    stubWindow(storage);
  });

  afterEach(() => {
    clearAuthFlow();
    vi.unstubAllGlobals();
  });

  it('round-trips the flow under one key', () => {
    writeAuthFlow(sample);
    expect(storage.data.get(AUTH_FLOW_STORAGE_KEY)).toBeTruthy();
    expect(readAuthFlow()).toEqual(sample);
  });

  it('never persists fields outside the flow state', () => {
    writeAuthFlow({ ...sample, password: 'hunter22', code: '123456' } as AuthFlowState);
    const stored = JSON.parse(storage.data.get(AUTH_FLOW_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(stored).sort()).toEqual(
      ['identifier', 'identifierType', 'purpose', 'resendAvailableAt', 'step'].sort(),
    );
    expect(storage.data.get(AUTH_FLOW_STORAGE_KEY)).not.toContain('hunter22');
  });

  it('patches only the given fields', () => {
    writeAuthFlow(sample);
    expect(patchAuthFlow({ step: 'new-password' })).toEqual({ ...sample, step: 'new-password' });
  });

  it('returns null and drops an unreadable value', () => {
    storage.data.set(AUTH_FLOW_STORAGE_KEY, '{"step":"hacked"}');
    expect(readAuthFlow()).toBeNull();
    expect(storage.data.has(AUTH_FLOW_STORAGE_KEY)).toBe(false);
  });

  it('clears the flow', () => {
    writeAuthFlow(sample);
    clearAuthFlow();
    expect(readAuthFlow()).toBeNull();
  });
});

describe('flowState when storage is unavailable', () => {
  afterEach(() => {
    clearAuthFlow();
    vi.unstubAllGlobals();
  });

  it('keeps the flow in memory when writes fail', () => {
    stubWindow(fakeStorage({ throwOnWrite: true }));
    writeAuthFlow(sample);
    expect(readAuthFlow()).toEqual(sample);
  });

  it('keeps the flow in memory when storage access throws', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): never {
        throw new Error('SecurityError');
      },
    });
    writeAuthFlow(sample);
    expect(readAuthFlow()).toEqual(sample);
  });

  it('returns null on the server (no window, no shared memory)', () => {
    expect(readAuthFlow()).toBeNull();
  });
});
