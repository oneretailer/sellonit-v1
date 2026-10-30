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

/** Local product routing until a backend role/onboarding contract is confirmed. */
const RECOMMENDATIONS: Record<AccountRole, RecommendationTarget> = {
  entrepreneur: { track: 'entrepreneur', nextRoute: '/dashboard/coming-soon' },
  retailer: { track: 'retailer', nextRoute: '/dashboard/coming-soon' },
  supplier: { track: 'supplier', nextRoute: '/dashboard/overview' },
};

function getLocalRecommendation(role: AccountRole): RoleRecommendation {
  return { role, ...RECOMMENDATIONS[role] };
}

export const localRoleApi: RoleApi = {
  saveRole(role) {
    return Promise.resolve(getLocalRecommendation(role));
  },
  getRecommendation: getLocalRecommendation,
};

/** TODO(backend): replace with the agreed save-role endpoint and response contract. */
export const httpRoleApi: RoleApi = {
  saveRole(_role) {
    return Promise.reject(new Error('TODO(backend): no role-selection endpoint is confirmed yet.'));
  },
  // The recommendation routes remain local until role-specific routes exist.
  getRecommendation: getLocalRecommendation,
};

// Single place to switch implementations after the backend contract exists.
export const roleApi: RoleApi = localRoleApi;
