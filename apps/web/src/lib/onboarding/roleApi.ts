import type { AccountRole } from './roles';

export type RoleRecommendation = {
  role: AccountRole;
  track: AccountRole;
  nextRoute: string;
};

export interface RoleApi {
  saveRole(role: AccountRole): Promise<RoleRecommendation>;
}

type RecommendationTarget = Omit<RoleRecommendation, 'role'>;

/** Local product routing until a backend role/onboarding contract is confirmed. */
const RECOMMENDATIONS: Record<AccountRole, RecommendationTarget> = {
  entrepreneur: { track: 'entrepreneur', nextRoute: '/account' },
  retailer: { track: 'retailer', nextRoute: '/account' },
  supplier: { track: 'supplier', nextRoute: '/account' },
};

export const localRoleApi: RoleApi = {
  saveRole(role) {
    return Promise.resolve({ role, ...RECOMMENDATIONS[role] });
  },
};

/** TODO(backend): replace with the agreed save-role endpoint and response contract. */
export const httpRoleApi: RoleApi = {
  saveRole(_role) {
    return Promise.reject(new Error('TODO(backend): no role-selection endpoint is confirmed yet.'));
  },
};

// Single place to switch implementations after the backend contract exists.
export const roleApi: RoleApi = localRoleApi;
