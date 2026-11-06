'use client';

/**
 * The ONE hook that turns business/session state into a dashboard access
 * state. Pages never map errors themselves; they render whatever StatePanel
 * this hook's state implies (see DashboardFrame).
 */
import { useEffect } from 'react';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { useBusiness, type BusinessPermission } from '@/lib/business/BusinessProvider';
import { mapDashboardError, type DashboardAccessState } from './access';

export type DashboardAccess = {
  state: DashboardAccessState;
  retry: () => void;
};

export function useDashboardAccess(permission?: BusinessPermission): DashboardAccess {
  const { refreshSession } = useAuthSession();
  const { businesses, activeBusiness, isLoading, error, refetch, can } = useBusiness();

  let state: DashboardAccessState = 'ok';
  if (isLoading) state = 'loading';
  else if (error) state = mapDashboardError(error);
  else if (businesses.length === 0) state = 'no-business';
  else if (
    activeBusiness?.status === 'SUSPENDED' ||
    (activeBusiness && activeBusiness.type !== 'SUPPLIER')
  ) {
    state = 'business-unavailable';
  } else if (permission && activeBusiness && !can(permission)) state = 'page-forbidden';

  // 401: reuse the app's existing session recovery (refresh → login redirect).
  useEffect(() => {
    if (state === 'session-expired') void refreshSession();
  }, [state, refreshSession]);

  return { state, retry: refetch };
}
