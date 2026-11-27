import type { components } from '@sellonit/shared';

export type Permission = components['schemas']['WorkspacePermission'];
export type Feature = components['schemas']['WorkspaceFeature'];
export type SessionContext = components['schemas']['WorkspaceSessionContext'];
export type SupplierStatus = components['schemas']['SupplierReviewStatus'];
export type SupplierPlan = components['schemas']['SupplierPlan'];
export type Product = components['schemas']['WorkspaceProduct'];
export type ProductStatus = components['schemas']['ProductStatus'];
export type CreateProductRequest = components['schemas']['CreateWorkspaceProductRequest'];
export type UpdateProductRequest = components['schemas']['UpdateWorkspaceProductRequest'];
export type SetMaximumMarkupRequest = components['schemas']['SetMaximumMarkupRequest'];
export type SupplierSummary = components['schemas']['AdminSupplierSummary'];
export type SupplierDetail = components['schemas']['AdminSupplierDetail'];
export type BusinessSubscription =
  components['schemas']['ApiResponseBusinessSubscription']['data'];
export type ChangeBusinessSubscriptionInput = {
  targetPlan: SupplierPlan;
  confirm?: true;
  choices?: Record<string, unknown>;
};
export type Pagination = components['schemas']['PaginationMeta'];
export type SupplierAction = 'approve' | 'reject' | 'suspend' | 'reinstate';
