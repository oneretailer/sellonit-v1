import { readOnboardingRole } from './flowState';
import type { AuthUser } from './types';
import { nextRouteForBusinessType, roleApi } from '@/lib/onboarding/roleApi';

/** The onboarding fields the destination needs. */
export type PostAuthUser = Pick<AuthUser, 'onboardingIntent'> | null | undefined;

/**
 * Where to send a signed-in user.
 *
 * The backend records the onboarding choice as `user.onboardingIntent`
 * (PUT /auth/business-intent), so that wins when it is set. Users who signed in
 * on this browser but whose account has no saved intent yet fall back to the
 * role kept in sessionStorage; a fresh browser intentionally returns to role
 * selection.
 */
export function getPostAuthDestination(user?: PostAuthUser): string {
  if (user?.onboardingIntent) {
    return nextRouteForBusinessType(user.onboardingIntent);
  }
  const role = readOnboardingRole();
  return role ? roleApi.getRecommendation(role).nextRoute : '/auth/role-selection';
}
