import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './globals.css';
import { AuthSessionProvider, type InitialAuthSession } from '@/lib/auth/AuthSessionProvider';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Poppins is exposed as the CSS variable `--font-poppins`. It is set on <html>
 * (not <body>) because `--font-sans` in `@theme` references it, and a `var()`
 * in a custom property resolves on the element that declares it. <body> then
 * uses `font-sans`, which is Poppins everywhere.
 */
export const metadata: Metadata = {
  title: {
    default: 'Sellonit',
    template: '%s — Sellonit',
  },
  description: 'Sellonit — virtual-inventory commerce and supply-chain platform.',
};

const ACCESS_COOKIE = 'sellonit_access_token';

async function readInitialSession(): Promise<InitialAuthSession> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { status: 'unauthenticated', user: null };

  const configuredUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
  const apiRoot = configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  try {
    const response = await fetch(`${apiRoot}/v1/auth/me`, {
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialSession = await readInitialSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <AuthSessionProvider initialSession={initialSession}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
