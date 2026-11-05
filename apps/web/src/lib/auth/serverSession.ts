import { cookies } from 'next/headers';
import type { InitialAuthSession } from './AuthSessionProvider';
import { AUTH_ENDPOINTS } from './authEndpoints';
import type { AuthUser } from './types';

const ACCESS_COOKIE = 'sellonit_access_token';

/**
 * Server-only bootstrap for RootLayout: forwards the `HttpOnly` session cookie
 * to the internal API `/api/v1/auth/me` endpoint so authenticated pages render
 * without a client round-trip flash.
 */
export async function readInitialSession(): Promise<InitialAuthSession> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { status: 'unauthenticated', user: null };

  const configuredUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
  const apiRoot = configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  try {
    const response = await fetch(`${apiRoot}/v1${AUTH_ENDPOINTS.me}`, {
      headers: { cookie: `${ACCESS_COOKIE}=${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(1800),
    });
    if (response.status === 401) return { status: 'unauthenticated', user: null };
    if (!response.ok) return { status: 'checking', user: null };
    const body = (await response.json()) as { data?: AuthUser };
    if (!body.data) return { status: 'checking', user: null };
    return { status: 'authenticated', user: body.data };
  } catch {
    // A tab-scoped display hint can keep the shell calm while the client retries.
    return { status: 'checking', user: null };
  }
}
