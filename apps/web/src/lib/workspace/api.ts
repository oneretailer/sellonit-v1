import { api, unwrap } from '@/lib/api';
import { ApiError, isEndpointNotImplemented } from '@/lib/api-client';
import type { SessionContext } from './types';

function buildFallbackSessionContext(isAdmin: boolean): SessionContext {
  return {
    platformRole: isAdmin ? 'ADMIN' : 'USER',
    permissions: isAdmin ? ['supplier:review'] : [],
    features: [],
    businesses: [],
    activeBusiness: null,
    supplierStatus: null,
  };
}

/**
 * Resolves workspace session capabilities.
 *
 * TODO(BE-005): `GET /api/v1/session/context` is not yet mounted on `apps/api`,
 * while `/api/v1/admin/suppliers*` (`BE-006`) is now live and protected by
 * `requirePermission('admin:read')`. When `/session/context` returns
 * `ENDPOINT_NOT_IMPLEMENTED`, probe `/admin/suppliers` so server-enforced RBAC
 * authoritatively distinguishes platform `ADMIN` (`200`) from regular users (`403`).
 */
export async function getSessionContext(signal?: AbortSignal): Promise<SessionContext> {
  try {
    return (await unwrap(api.GET('/session/context', { signal }))).data;
  } catch (error) {
    if (!isEndpointNotImplemented(error)) {
      throw error;
    }
    try {
      await unwrap(
        api.GET('/admin/suppliers', {
          params: { query: { status: 'PENDING_REVIEW', page: 1, pageSize: 1 } },
          signal,
        }),
      );
      return buildFallbackSessionContext(true);
    } catch (adminProbeError) {
      if (adminProbeError instanceof ApiError && adminProbeError.status === 403) {
        return buildFallbackSessionContext(false);
      }
      throw adminProbeError;
    }
  }
}

/** Existing GET /me (server base already includes /v1), not a duplicate /v1/me path. */
export async function confirmIdentity(signal?: AbortSignal): Promise<boolean> {
  await unwrap(api.GET('/me', { signal }));
  return true;
}
