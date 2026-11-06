import type { SupplierAction, SupplierStatus } from './types';

/** UI affordances only. The backend remains authoritative for every transition. */
export function availableSupplierActions(status: SupplierStatus): readonly SupplierAction[] {
  switch (status) {
    case 'PENDING_REVIEW':
      return ['approve', 'reject'];
    case 'APPROVED':
      return ['suspend'];
    case 'SUSPENDED':
      return ['reinstate'];
    case 'REJECTED':
    case 'DRAFT':
      return [];
  }
}

export function nextSupplierStatus(action: SupplierAction): SupplierStatus {
  switch (action) {
    case 'approve':
    case 'reinstate':
      return 'APPROVED';
    case 'reject':
      return 'REJECTED';
    case 'suspend':
      return 'SUSPENDED';
  }
}
