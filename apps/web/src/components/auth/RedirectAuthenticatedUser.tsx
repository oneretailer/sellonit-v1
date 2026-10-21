'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { getMe } from '@/lib/auth/api';
import { getPostAuthDestination } from '@/lib/auth/postAuthDestination';

async function getSessionAfterHydration() {
  try {
    return await getMe();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    // A freshly verified or logged-in cookie can become visible just after navigation.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return getMe();
  }
}

/** Redirects signed-in visitors away from public entry/auth routes. */
export function RedirectAuthenticatedUser({
  children,
  locationKey,
}: {
  children: ReactNode;
  locationKey: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void getSessionAfterHydration()
      .then(() => {
        if (active) router.replace(getPostAuthDestination());
      })
      .catch(() => {
        // Unauthenticated users and transient API failures may use the public route.
      });
    return () => {
      active = false;
    };
  }, [locationKey, router]);

  return children;
}
