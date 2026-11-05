/** Every tenant query is scoped by business; platform admin uses the explicit platform scope. */
export const workspaceKeys = {
  session: (userId: string | null) => ['session', userId, 'workspace-context'] as const,
  products: (businessId: string) => ['workspace', businessId, 'products'] as const,
  productList: (businessId: string, filters: unknown) => [...workspaceKeys.products(businessId), 'list', filters] as const,
  product: (businessId: string, id: string) => [...workspaceKeys.products(businessId), 'detail', id] as const,
  suppliers: (platformUserId: string) => ['workspace', 'platform', platformUserId, 'admin-suppliers'] as const,
  supplierList: (platformUserId: string, filters: unknown) => [...workspaceKeys.suppliers(platformUserId), 'list', filters] as const,
  supplier: (platformUserId: string, id: string) => [...workspaceKeys.suppliers(platformUserId), 'detail', id] as const,
};
