/** Every tenant query is scoped by business; platform admin uses the explicit platform scope. */
export const workspaceKeys = {
  session: (userId: string | null) => ['session', userId, 'workspace-context'] as const,
  suppliers: (platformUserId: string) => ['workspace', 'platform', platformUserId, 'admin-suppliers'] as const,
  supplierList: (platformUserId: string, filters: unknown) => [...workspaceKeys.suppliers(platformUserId), 'list', filters] as const,
  supplier: (platformUserId: string, id: string) => [...workspaceKeys.suppliers(platformUserId), 'detail', id] as const,
};
