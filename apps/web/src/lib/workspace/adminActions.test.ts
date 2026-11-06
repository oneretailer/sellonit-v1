import { describe, expect, it } from 'vitest';
import { availableSupplierActions, nextSupplierStatus } from './adminActions';
import type { SupplierStatus } from './types';
describe('status-derived admin actions', () => {
  it.each([
    ['PENDING_REVIEW', ['approve', 'reject']],
    ['APPROVED', ['suspend']],
    ['SUSPENDED', ['reinstate']],
    ['REJECTED', []],
    ['DRAFT', []],
  ] as [SupplierStatus, string[]][])('%s exposes only valid actions', (status, actions) =>
    expect(availableSupplierActions(status)).toEqual(actions),
  );
  it('maps transitions', () =>
    expect(
      (['approve', 'reject', 'suspend', 'reinstate'] as const).map(nextSupplierStatus),
    ).toEqual(['APPROVED', 'REJECTED', 'SUSPENDED', 'APPROVED']));
});
