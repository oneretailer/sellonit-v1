'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@/lib/api-client';
import { getMe } from './api';
import type { AuthUser } from './types';

const SESSION_HINT_KEY = 'sellonit.auth.session-hint';

type AuthSessionStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';
export type InitialAuthSession = {
  status: AuthSessionStatus;
  user: AuthUser | null;
};

type AuthSessionContextValue = {
  status: AuthSessionStatus;
  user: AuthUser | null;
  cachedDisplayName: string | null;
  refreshSession: () => Promise<AuthUser | null>;
  acceptAuthenticatedUser: (user: AuthUser) => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

type SessionHint = { authenticated: true; displayName?: string };
const sessionHintListeners = new Set<() => void>();

function notifySessionHintListeners(): void {
  sessionHintListeners.forEach((listener) => listener());
}

function readSessionHint(): SessionHint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_HINT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'authenticated' in value &&
      value.authenticated === true &&
      (!('displayName' in value) || typeof value.displayName === 'string')
    ) {
      return value as SessionHint;
    }
  } catch {
    // Storage is an optional paint hint, never an authorization source.
  }
  return null;
}

function getCachedDisplayName(): string | null {
  return readSessionHint()?.displayName ?? null;
}

function subscribeSessionHint(listener: () => void): () => void {
  sessionHintListeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    sessionHintListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

function writeSessionHint(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  const displayName = `${user.firstName} ${user.lastName}`.trim();
  try {
    window.sessionStorage.setItem(
      SESSION_HINT_KEY,
      JSON.stringify({
        authenticated: true,
        ...(displayName ? { displayName } : {}),
      } satisfies SessionHint),
    );
  } catch {
    // The server/API session remains authoritative when storage is blocked.
  }
  notifySessionHintListeners();
}

function clearSessionHint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  notifySessionHintListeners();
}

async function fetchSessionWithHydrationRetry(): Promise<AuthUser> {
  try {
    return (await getMe()).data;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await new Promise((resolve) => setTimeout(resolve, 180));
    return (await getMe()).data;
  }
}

export function AuthSessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: InitialAuthSession;
}) {
  const [status, setStatus] = useState<AuthSessionStatus>(initialSession.status);
  const [user, setUser] = useState<AuthUser | null>(initialSession.user);
  const cachedDisplayName = useSyncExternalStore(
    subscribeSessionHint,
    getCachedDisplayName,
    () => null,
  );

  const acceptAuthenticatedUser = useCallback((nextUser: AuthUser) => {
    writeSessionHint(nextUser);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus('checking');
    try {
      const nextUser = await fetchSessionWithHydrationRetry();
      acceptAuthenticatedUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSessionHint();
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }
      setUser(null);
      setStatus('error');
      return null;
    }
  }, [acceptAuthenticatedUser]);

  useEffect(() => {
    if (initialSession.status === 'authenticated' && initialSession.user) {
      writeSessionHint(initialSession.user);
      return;
    }
    if (initialSession.status === 'unauthenticated') {
      clearSessionHint();
      return;
    }
    const refreshTimer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [initialSession, refreshSession]);

  const value = useMemo(
    () => ({ status, user, cachedDisplayName, refreshSession, acceptAuthenticatedUser }),
    [status, user, cachedDisplayName, refreshSession, acceptAuthenticatedUser],
  );
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider.');
  return context;
}
