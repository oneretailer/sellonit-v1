import { readOnboardingRole } from './flowState';
import { roleApi } from '@/lib/onboarding/roleApi';

/**
 * The backend user contract has no onboarding role yet. Use the role saved in
 * this browser as an interim; a fresh browser intentionally returns to role selection.
 */
export function getPostAuthDestination(): string {
  const role = readOnboardingRole();
  return role ? roleApi.getRecommendation(role).nextRoute : '/auth/role-selection';
}
