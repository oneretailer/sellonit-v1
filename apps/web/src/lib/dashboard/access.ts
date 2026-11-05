/**
 * Central dashboard error → access-state mapping (one place, not per page).
 *
 * - Network failure or 5xx            → load-failed (Retry)
 * - 404/410 for the business          → business-unavailable (Switch business)
 * - 403 on the business itself        → business-denied (Go back)
 * - 403 on a page/action for the role → page-forbidden (handled via can())
 * - Zero businesses                   → no-business (handled via list length)
 * - 401                               → existing session refresh/redirect
 */
import { ApiError, NetworkError } from '@/lib/api-client';

export type DashboardAccessState =
  | 'ok'
  | 'loading'
  | 'session-expired'
  | 'load-failed'
  | 'business-unavailable'
  | 'business-denied'
  | 'page-forbidden'
  | 'no-business';

export function mapDashboardError(error: unknown): DashboardAccessState {
  if (error instanceof NetworkError) return 'load-failed';
  if (!(error instanceof ApiError)) return 'load-failed';
  if (error.status === 401) return 'session-expired';
  if (error.status === 404 || error.status === 410) return 'business-unavailable';
  if (error.status === 403) return 'business-denied';
  if (error.status >= 500) return 'load-failed';
  return 'load-failed';
}
