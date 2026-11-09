import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENDPOINT_NOT_IMPLEMENTED_CODE } from '@/lib/api-client';
import { getSessionContext } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSessionContext admin fallback', () => {
  it('resolves ADMIN capabilities via /admin/suppliers when /session/context is not mounted', async () => {
    vi.stubGlobal('fetch', (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/v1/session/context')) {
        return Promise.resolve(
          new Response('<!DOCTYPE html><pre>Cannot GET /api/v1/session/context</pre>', {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        );
      }
      if (url.includes('/api/v1/admin/suppliers')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [],
              meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const context = await getSessionContext();
    expect(context.platformRole).toBe('ADMIN');
    expect(context.permissions).toContain('supplier:review');
  });

  it('resolves USER capabilities when /admin/suppliers returns 403 FORBIDDEN', async () => {
    vi.stubGlobal('fetch', (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/v1/session/context')) {
        return Promise.resolve(
          new Response('Cannot GET /api/v1/session/context', {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Permission denied' } }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const context = await getSessionContext();
    expect(context.platformRole).toBe('USER');
    expect(context.permissions).toEqual([]);
  });

  it('rethrows ENDPOINT_NOT_IMPLEMENTED when neither /session/context nor /admin/suppliers is mounted', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('<!DOCTYPE html><pre>Cannot GET /api/v1/admin/suppliers</pre>', {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    );

    await expect(getSessionContext()).rejects.toMatchObject({
      code: ENDPOINT_NOT_IMPLEMENTED_CODE,
    });
  });
});
