'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { listBusinesses } from '@/lib/business/businessesApi';
import { confirmIdentity } from '@/lib/workspace/api';
import { AUTH_ROUTE } from './authDestination';
import { broadcastSignupCompleted, subscribeAuthSignals } from './crossTab';
import type { AccountRole } from '@/lib/onboarding/roles';

export const SIGNUP_COMPLETED_MESSAGE =
  'You finished sign-up in another tab. Taking you to your dashboard.';

export type SignupCompletionOptions = {
  /**
   * `'onboarding'` (default): treats any persisted business membership as
   * completed initial signup across tabs.
   * `'add'`: allows an already-onboarded user to create an additional business
   * from the Business Switcher without redirecting before submit.
   */
  mode?: 'onboarding' | 'add';
  userId?: string | null;
};

/** A browser signal is only a hint. GET /me + GET /businesses decide. */
export function useSignupCompletion(options: SignupCompletionOptions = {}) {
  const { mode = 'onboarding', userId = null } = options;
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationError = useRef<string | null>(null);
  const lockedRef = useRef(false);
  const mounted = useRef(true);
  const checking = useRef<Promise<boolean> | null>(null);

  const lock = useCallback(() => {
    lockedRef.current = true;
    setLocked(true);
  }, []);

  const confirmOnServer = useCallback(async (): Promise<boolean> => {
    if (mode === 'add') {
      confirmationError.current = null;
      return false;
    }
    if (checking.current) return checking.current;
    const task = (async () => {
      try {
        confirmationError.current = null;
        await confirmIdentity();
        const businesses = await listBusinesses(userId);
        if (businesses.length === 0) {
          // A signal is not proof. Restore inputs if the server says signup is unfinished.
          lockedRef.current = false;
          if (mounted.current) {
            setLocked(false);
            setError(null);
          }
          return false;
        }
        if (!mounted.current) return true;
        lock();
        router.replace(AUTH_ROUTE.dashboard);
        return true;
      } catch (caught) {
        confirmationError.current =
          caught instanceof ApiError && caught.status === 401
            ? 'Your session expired. Log in again to continue.'
            : 'We could not confirm sign-up. Check your connection and retry.';
        if (mounted.current) setError(confirmationError.current);
        return false;
      } finally {
        checking.current = null;
      }
    })();
    checking.current = task;
    return task;
  }, [lock, mode, router, userId]);

  useEffect(() => {
    mounted.current = true;
    if (mode === 'add') {
      return () => {
        mounted.current = false;
      };
    }
    const unsubscribe = subscribeAuthSignals((signal) => {
      if (signal.type === 'SIGNUP_COMPLETED') {
        lock();
        void confirmOnServer();
      }
    });
    const recheck = () => {
      if (document.visibilityState === 'visible') void confirmOnServer();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [confirmOnServer, lock, mode]);

  const complete = useCallback(
    (accountType: AccountRole) => {
      lock();
      router.replace(AUTH_ROUTE.dashboard);
      broadcastSignupCompleted(accountType);
    },
    [lock, router],
  );

  const retry = useCallback(() => {
    lock();
    void confirmOnServer();
  }, [confirmOnServer, lock]);

  const getConfirmationError = useCallback(() => confirmationError.current, []);

  return {
    locked,
    lock,
    error,
    confirmOnServer,
    getConfirmationError,
    complete,
    retry,
    message: SIGNUP_COMPLETED_MESSAGE,
  };
}
