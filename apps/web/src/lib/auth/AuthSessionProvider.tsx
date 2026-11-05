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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionContext } from '@/lib/workspace/api';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { Feature, Permission, SessionContext } from '@/lib/workspace/types';
import { ApiError } from '@/lib/api-client';
import { getMe } from './api';
import type { AuthSessionStatus } from './authDestination';
import type { AuthUser } from './types';

const SESSION_HINT_KEY = 'sellonit.auth.session-hint';

export type { AuthSessionStatus };
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
  workspace: SessionContext | null;
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'error';
  workspaceError: unknown;
  can: (permission: Permission) => boolean;
  hasFeature: (feature: Feature) => boolean;
  refreshWorkspace: () => Promise<SessionContext | null>;
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
  const queryClient = useQueryClient();
  const contextQuery = useQuery({
    queryKey: workspaceKeys.session(user?.id ?? null),
    queryFn: ({ signal }) => getSessionContext(signal),
    enabled: status === 'authenticated' && user !== null,
  });
  const workspace = contextQuery.data ?? null;
  const workspaceStatus: AuthSessionContextValue['workspaceStatus'] = status !== 'authenticated' ? 'idle' : contextQuery.isError ? 'error' : workspace ? 'ready' : 'loading';
  const can = useCallback((permission: Permission) => workspace?.permissions.includes(permission) ?? false, [workspace]);
  const hasFeature = useCallback((feature: Feature) => workspace?.features.includes(feature) ?? false, [workspace]);
  const { refetch: refetchWorkspace } = contextQuery;
  const refreshWorkspace = useCallback(async () => {
    const result = await refetchWorkspace();
    return result.data ?? null;
  }, [refetchWorkspace]);
  const cachedDisplayName = useSyncExternalStore(
    subscribeSessionHint,
    getCachedDisplayName,
    () => null,
  );

  const acceptAuthenticatedUser = useCallback((nextUser: AuthUser) => {
    writeSessionHint(nextUser);
    setUser(nextUser);
    setStatus('authenticated');
    void queryClient.invalidateQueries({ queryKey: ['session'] });
  }, [queryClient]);

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
    () => ({ status, user, cachedDisplayName, refreshSession, acceptAuthenticatedUser, workspace, workspaceStatus, workspaceError: contextQuery.error, can, hasFeature, refreshWorkspace }),
    [status, user, cachedDisplayName, refreshSession, acceptAuthenticatedUser, workspace, workspaceStatus, contextQuery.error, can, hasFeature, refreshWorkspace],
  );
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider.');
  return context;
}

/** Convenience alias; there is still only one session provider. */
export const useSession = useAuthSession;
