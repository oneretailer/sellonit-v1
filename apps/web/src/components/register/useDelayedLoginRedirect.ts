'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useCallback, useEffect, useRef } from 'react';
import { LOGIN_REDIRECT_DELAY_MS } from '@/lib/auth/existingAccount';

/**
 * Returns a function that sends the user to `href` after a short delay, so the
 * "account already exists" notice can be read first. A pending redirect is
 * cancelled if the step unmounts.
 */
export function useDelayedLoginRedirect(): (href: Route) => void {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return useCallback(
    (href: Route) => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        router.push(href);
      }, LOGIN_REDIRECT_DELAY_MS);
    },
    [router],
  );
}
