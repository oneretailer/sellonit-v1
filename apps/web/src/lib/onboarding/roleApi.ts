import { apiFetch } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from '@/lib/auth/authEndpoints';
import type { BusinessType } from '@/lib/auth/types';
import type { AccountRole } from './roles';

export type RoleRecommendation = {
  role: AccountRole;
  track: AccountRole;
  nextRoute: string;
};

export interface RoleApi {
  saveRole(role: AccountRole): Promise<RoleRecommendation>;
  getRecommendation(role: AccountRole): RoleRecommendation;
}

type RecommendationTarget = Omit<RoleRecommendation, 'role'>;

/**
 * Where each role goes after onboarding. The backend stores the selection but
 * has no role-specific dashboard routes yet, so these destinations stay local.
 */
const RECOMMENDATIONS: Record<AccountRole, RecommendationTarget> = {
  entrepreneur: { track: 'entrepreneur', nextRoute: '/dashboard/coming-soon' },
  retailer: { track: 'retailer', nextRoute: '/dashboard/coming-soon' },
  supplier: { track: 'supplier', nextRoute: '/dashboard/overview' },
};

/**
 * The onboarding choice is persisted on the user as `onboardingIntent`
 * (PUT /auth/business-intent). The backend enum is
 * RETAILER | ENTREPRENEUR | ENTERPRISE — "supplier" has no enum member, and
 * ENTERPRISE is the supplier track (docs/v1.0.3-alignment.md: "Enterprise
 * extends Supplier"), so it maps there.
 */
const BUSINESS_TYPE_BY_ROLE: Record<AccountRole, BusinessType> = {
  entrepreneur: 'ENTREPRENEUR',
  retailer: 'RETAILER',
  supplier: 'ENTERPRISE',
};

const ROLE_BY_BUSINESS_TYPE: Record<BusinessType, AccountRole> = {
  ENTREPRENEUR: 'entrepreneur',
  RETAILER: 'retailer',
  ENTERPRISE: 'supplier',
};

/** The value sent as `businessType` to PUT /auth/business-intent. */
export function businessTypeForRole(role: AccountRole): BusinessType {
  return BUSINESS_TYPE_BY_ROLE[role];
}

/** The onboarding role for a stored `onboardingIntent`. */
export function roleForBusinessType(businessType: BusinessType): AccountRole {
  return ROLE_BY_BUSINESS_TYPE[businessType];
}

/** The post-auth route for a stored `onboardingIntent`. */
export function nextRouteForBusinessType(businessType: BusinessType): string {
  return RECOMMENDATIONS[roleForBusinessType(businessType)].nextRoute;
}

function getLocalRecommendation(role: AccountRole): RoleRecommendation {
  return { role, ...RECOMMENDATIONS[role] };
}

/** Recommendation routes without a save request. */
export const localRoleApi: RoleApi = {
  saveRole(role) {
    return Promise.resolve(getLocalRecommendation(role));
  },
  getRecommendation: getLocalRecommendation,
};

/**
 * Saves the onboarding role to the authenticated user.
 *
 * PUT /api/v1/auth/business-intent `{ businessType }` → 200 `{ data: user }`.
 * Requires the session cookie (the role-selection route is behind
 * RequireAuthenticatedSession). The response body is not needed: the
 * recommendation routes are still decided by the web app.
 */
export const httpRoleApi: RoleApi = {
  async saveRole(role) {
    await apiFetch(AUTH_ENDPOINTS.businessIntent, {
      method: 'PUT',
      body: JSON.stringify({ businessType: businessTypeForRole(role) }),
    });
    return getLocalRecommendation(role);
  },
  // The recommendation routes remain local until role-specific routes exist.
  getRecommendation: getLocalRecommendation,
};

/** The onboarding flow now saves to the backend; swap here if that changes. */
export const roleApi: RoleApi = httpRoleApi;
