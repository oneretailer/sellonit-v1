import { describe, expect, it } from 'vitest';
import { ROLE_OPTIONS } from './roles';
import { httpRoleApi, localRoleApi, roleApi } from './roleApi';

describe('role API selection and local recommendations', () => {
  it('maps supplier to Overview and entrepreneur/retailer to coming soon', async () => {
    for (const option of ROLE_OPTIONS) {
      const nextRoute =
        option.recommendationKey === 'supplier' ? '/dashboard/overview' : '/dashboard/coming-soon';
      await expect(localRoleApi.saveRole(option.recommendationKey)).resolves.toEqual({
        role: option.recommendationKey,
        track: option.recommendationKey,
        nextRoute,
      });
    }
  });

  it('uses the local implementation until a confirmed backend contract exists', () => {
    expect(roleApi).toBe(localRoleApi);
  });

  it('derives a recommendation without issuing another save request', () => {
    expect(roleApi.getRecommendation('supplier')).toEqual({
      role: 'supplier',
      track: 'supplier',
      nextRoute: '/dashboard/overview',
    });
    expect(roleApi.getRecommendation('retailer').nextRoute).toBe('/dashboard/coming-soon');
    expect(roleApi.getRecommendation('entrepreneur').nextRoute).toBe('/dashboard/coming-soon');
  });

  it('keeps the future HTTP role save adapter inactive until a contract is supplied', async () => {
    await expect(httpRoleApi.saveRole('retailer')).rejects.toThrow(
      'TODO(backend): no role-selection endpoint is confirmed yet.',
    );
  });
});
