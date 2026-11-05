'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { confirmIdentity, getSessionContext } from '@/lib/workspace/api';
import { broadcastSignupCompleted, subscribeAuthSignals } from './crossTab';
import type { AccountRole } from '@/lib/onboarding/roles';

export const SIGNUP_COMPLETED_MESSAGE = 'You finished sign-up in another tab. Taking you to your dashboard.';
/** A browser signal is only a hint. GET /me + actual persisted membership decide. */
export function useSignupCompletion() {
  const router = useRouter();
  const [locked, setLocked] = useState(false); const [error, setError] = useState<string | null>(null);
  const confirmationError = useRef<string | null>(null); const lockedRef = useRef(false); const mounted = useRef(true); const checking = useRef<Promise<boolean> | null>(null);
  const lock = useCallback(() => { lockedRef.current = true; setLocked(true); }, []);
  const confirmOnServer = useCallback(async (): Promise<boolean> => {
    if (checking.current) return checking.current;
    const task = (async () => {
      try {
        confirmationError.current = null;
        await confirmIdentity();
        const context = await getSessionContext();
        if (context.businesses.length === 0) {
          // A signal is not proof. Restore inputs if the server says signup is unfinished.
          lockedRef.current = false;
          if (mounted.current) { setLocked(false); setError(null); }
          return false;
        }
        if (!mounted.current) return true;
        lock(); router.replace('/dashboard'); return true;
      } catch (caught) {
        confirmationError.current = caught instanceof ApiError && caught.status === 401 ? 'Your session expired. Log in again to continue.' : 'We could not confirm sign-up. Check your connection and retry.';
        if (mounted.current) setError(confirmationError.current);
        return false;
      } finally { checking.current = null; }
    })();
    checking.current = task;
    return task;
  }, [lock, router]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeAuthSignals((signal) => { if (signal.type === 'SIGNUP_COMPLETED') { lock(); void confirmOnServer(); } });
    const recheck = () => { if (document.visibilityState === 'visible') void confirmOnServer(); };
    window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck);
    return () => { mounted.current = false; unsubscribe(); window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
  }, [confirmOnServer, lock]);
  const complete = useCallback((accountType: AccountRole) => { lock(); router.replace('/dashboard'); broadcastSignupCompleted(accountType); }, [lock, router]);
  const retry = useCallback(() => { lock(); void confirmOnServer(); }, [confirmOnServer, lock]);
  const getConfirmationError = useCallback(() => confirmationError.current, []);
  return { locked, lock, error, confirmOnServer, getConfirmationError, complete, retry, message: SIGNUP_COMPLETED_MESSAGE };
}
