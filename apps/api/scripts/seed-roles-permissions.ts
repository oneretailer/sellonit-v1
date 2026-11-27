import { isMainModule, prisma, runSeedScript } from './seed-database.js';

const roles = [
  { key: 'ADMIN', name: 'Administrator' },
  { key: 'OWNER', name: 'Business owner' },
  { key: 'SUPPLIER', name: 'Supplier' },
  { key: 'RETAILER', name: 'Retailer' },
];

const permissions = [
  { key: 'admin:read', name: 'Read administration data' },
  { key: 'admin:write', name: 'Manage administration data' },
  { key: 'business:write', name: 'Manage businesses' },
  { key: 'supplier_profile:write', name: 'Manage supplier profile' },
  { key: 'product:read', name: 'Read supplier products' },
  { key: 'product:write', name: 'Manage supplier products' },
  { key: 'pricing:set', name: 'Set product pricing rules' },
];

export async function seedRolesAndPermissions(): Promise<void> {
  const roleRecords = new Map<string, { id: string }>();
  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role,
      select: { id: true },
    });
    roleRecords.set(role.key, record);
  }

  const permissionRecords = new Map<string, { id: string }>();
  for (const permission of permissions) {
    const record = await prisma.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name },
      create: permission,
      select: { id: true },
    });
    permissionRecords.set(permission.key, record);
  }

  const grants: Record<string, string[]> = {
    ADMIN: permissions.map((permission) => permission.key),
    OWNER: ['product:read', 'product:write', 'pricing:set'],
  };
  for (const [roleKey, permissionKeys] of Object.entries(grants)) {
    for (const permissionKey of permissionKeys) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecords.get(roleKey)!.id,
            permissionId: permissionRecords.get(permissionKey)!.id,
          },
        },
        update: {},
        create: {
          roleId: roleRecords.get(roleKey)!.id,
          permissionId: permissionRecords.get(permissionKey)!.id,
        },
      });
    }
  }
}

if (isMainModule(import.meta.url))
  void runSeedScript('roles and permissions', seedRolesAndPermissions);
