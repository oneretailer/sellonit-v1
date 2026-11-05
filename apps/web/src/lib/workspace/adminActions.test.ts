import { describe, expect, it } from 'vitest';
import { availableSupplierActions, nextSupplierStatus } from './adminActions';
import { publishAvailability } from './publishState';
import type { ProductStatus, SupplierStatus } from './types';
describe('status-derived admin actions', () => {
  it.each([['PENDING_REVIEW', ['approve', 'reject']], ['APPROVED', ['suspend']], ['SUSPENDED', ['reinstate']], ['REJECTED', []], ['DRAFT', []]] as [SupplierStatus, string[]][])('%s exposes only valid actions', (status, actions) => expect(availableSupplierActions(status)).toEqual(actions));
  it('maps transitions', () => expect((['approve', 'reject', 'suspend', 'reinstate'] as const).map(nextSupplierStatus)).toEqual(['APPROVED', 'REJECTED', 'SUSPENDED', 'APPROVED']));
});
describe('publish disabled states', () => {
  it('hides without grant', () => expect(publishAvailability(false, 'APPROVED', 'DRAFT').visible).toBe(false));
  it.each([null, 'DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as (SupplierStatus | null)[])('disables for supplier status %s with explanation', (status) => expect(publishAvailability(true, status, 'DRAFT')).toMatchObject({ visible: true, enabled: false, reason: expect.stringContaining('approved') }));
  it('archives are read-only even with approval', () => expect(publishAvailability(true, 'APPROVED', 'ARCHIVED')).toMatchObject({ enabled: false, action: null }));
  it.each(['DRAFT', 'UNPUBLISHED'] as ProductStatus[])('publishes %s', (status) => expect(publishAvailability(true, 'APPROVED', status).action).toBe('publish'));
  it('unpublishes published products', () => expect(publishAvailability(true, 'APPROVED', 'PUBLISHED').action).toBe('unpublish'));
});
