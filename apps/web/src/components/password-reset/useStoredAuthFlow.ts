'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  parseAuthFlow,
  patchAuthFlow,
  readAuthFlowRaw,
  subscribeAuthFlow,
  type AuthFlowState,
} from '@/lib/auth/flowState';

/** Client snapshot: the raw stored value (null when there is none). */
function getClientSnapshot(): string | null {
  return readAuthFlowRaw();
}

/**
 * Server snapshot and first client render: undefined, which means "not read
 * yet". Storage does not exist on the server, so guards must wait for it. A
 * null here would wrongly look like "no flow" and redirect.
 */
function getServerSnapshot(): undefined {
  return undefined;
}

/**
 *   undefined: not read yet (render nothing)
 *   null:      no saved flow (guards redirect to the start)
 *   state:     the saved flow
 * `update` merges changes into storage. Components re-render through the
 * subscription, so no effect is needed to sync state.
 */
export function useStoredAuthFlow(): readonly [
  AuthFlowState | null | undefined,
  (changes: Partial<AuthFlowState>) => void,
] {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeAuthFlow,
    getClientSnapshot,
    getServerSnapshot,
  );
  const flow = useMemo(() => (raw === undefined ? undefined : parseAuthFlow(raw)), [raw]);
  const update = useCallback((changes: Partial<AuthFlowState>) => {
    patchAuthFlow(changes);
  }, []);
  return [flow, update] as const;
}
