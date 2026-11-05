import { api, unwrap } from '@/lib/api';
import type { SessionContext } from './types';

export async function getSessionContext(signal?: AbortSignal): Promise<SessionContext> {
  return (await unwrap(api.GET('/session/context', { signal }))).data;
}

/** Existing GET /me (server base already includes /v1), not a duplicate /v1/me path. */
export async function confirmIdentity(signal?: AbortSignal): Promise<boolean> {
  await unwrap(api.GET('/me', { signal }));
  return true;
}
