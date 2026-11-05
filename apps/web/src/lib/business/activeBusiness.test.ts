/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_BUSINESS_HEADER,
  ACTIVE_BUSINESS_STORAGE_KEY,
  getActiveBusinessId,
  setActiveBusinessId,
} from './activeBusiness';
import { apiFetch } from '@/lib/api-client';

beforeEach(() => {
  localStorage.clear();
  setActiveBusinessId(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setActiveBusinessId(null);
});

describe('active business scope', () => {
  it('persists the active id and clears it', () => {
    setActiveBusinessId('biz-1');
    expect(localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY)).toBe('biz-1');
    expect(getActiveBusinessId()).toBe('biz-1');
    setActiveBusinessId(null);
    expect(localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY)).toBeNull();
    expect(getActiveBusinessId()).toBeNull();
  });

  it('sends X-Business-Id on every API request when a business is active', async () => {
    setActiveBusinessId('biz-9');
    const calls: { url: string; headers: Headers }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), headers: new Headers(init.headers) });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    });
    await apiFetch('/supplier/products');
    expect(calls[0]?.headers.get(ACTIVE_BUSINESS_HEADER)).toBe('biz-9');
  });

  it('omits the header when no business is active and never overrides an explicit one', async () => {
    const calls: Headers[] = [];
    vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) => {
      calls.push(new Headers(init.headers));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    await apiFetch('/supplier/products');
    expect(calls[0]?.get(ACTIVE_BUSINESS_HEADER)).toBeNull();
    setActiveBusinessId('biz-9');
    await apiFetch('/supplier/products', { headers: { [ACTIVE_BUSINESS_HEADER]: 'explicit' } });
    expect(calls[1]?.get(ACTIVE_BUSINESS_HEADER)).toBe('explicit');
  });
});
