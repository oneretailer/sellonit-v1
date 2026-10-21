import { describe, expect, it } from 'vitest';
import { ROLE_OPTIONS } from './roles';
import { httpRoleApi, localRoleApi, roleApi } from './roleApi';

describe('role API selection and local recommendations', () => {
  it('maps every option through the local lookup and returns the existing account route', async () => {
    for (const option of ROLE_OPTIONS) {
      await expect(localRoleApi.saveRole(option.recommendationKey)).resolves.toEqual({
        role: option.recommendationKey,
        track: option.recommendationKey,
        nextRoute: '/account',
      });
    }
  });

  it('uses the local implementation until a confirmed backend contract exists', () => {
    expect(roleApi).toBe(localRoleApi);
  });

  it('derives a saved role recommendation without issuing another save request', () => {
    expect(roleApi.getRecommendation('retailer')).toEqual({
      role: 'retailer',
      track: 'retailer',
      nextRoute: '/account',
    });
  });

  it('keeps the future HTTP adapter inactive until a contract is supplied', async () => {
    await expect(httpRoleApi.saveRole('retailer')).rejects.toThrow(
      'TODO(backend): no role-selection endpoint is confirmed yet.',
    );
  });
});
