import type { ProductStatus, SupplierStatus } from './types';

export function publishAvailability(canPublish: boolean, supplierStatus: SupplierStatus | null, productStatus: ProductStatus) {
  if (!canPublish) return { visible: false, enabled: false, action: null, reason: 'You need product:publish permission.' };
  if (productStatus === 'ARCHIVED') return { visible: true, enabled: false, action: null, reason: 'Archived products are read-only.' };
  if (supplierStatus !== 'APPROVED') return { visible: true, enabled: false, action: null, reason: 'Publishing is available after your supplier account is approved.' };
  if (productStatus === 'PUBLISHED') return { visible: true, enabled: true, action: 'unpublish' as const, reason: 'Remove this product from the catalogue.' };
  return { visible: true, enabled: true, action: 'publish' as const, reason: 'Make this product available to retailers.' };
}
