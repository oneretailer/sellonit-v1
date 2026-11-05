import 'dotenv/config';
import bcrypt from 'bcrypt';
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const rootEnvFile = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
];

async function main(): Promise<void> {
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

  for (const permissionKey of permissions.map(({ key }) => key)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleRecords.get('ADMIN')!.id,
          permissionId: permissionRecords.get(permissionKey)!.id,
        },
      },
      update: {},
      create: {
        roleId: roleRecords.get('ADMIN')!.id,
        permissionId: permissionRecords.get(permissionKey)!.id,
      },
    });
  }

  const planKeys = ['ENTERPRISE', 'ENTERPRISE_PLUS'];
  const planRecords = new Map<string, { id: string }>();
  for (const key of planKeys) {
    const record = await prisma.plan.upsert({
      where: { key },
      update: { name: key[0] + key.slice(1).toLowerCase() },
      create: { key, name: key[0] + key.slice(1).toLowerCase() },
      select: { id: true },
    });
    planRecords.set(key, record);
  }
  for (const [from, to] of [['ENTERPRISE', 'ENTERPRISE_PLUS']] as const) {
    await prisma.planTransition.upsert({
      where: {
        fromPlanId_toPlanId: {
          fromPlanId: planRecords.get(from)!.id,
          toPlanId: planRecords.get(to)!.id,
        },
      },
      update: {},
      create: {
        fromPlanId: planRecords.get(from)!.id,
        toPlanId: planRecords.get(to)!.id,
      },
    });
  }

  const email = (process.env.ADMIN_EMAIL ?? 'admin@sellonit.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const admin = await prisma.user.upsert({
    where: { email },
    update: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    create: {
      email,
      firstName: 'Sellonit',
      lastName: 'Admin',
      passwordHash: await bcrypt.hash(password, 12),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId: admin.id, roleId: roleRecords.get('ADMIN')!.id, businessId: null },
    select: { id: true },
  });
  if (!assignment) {
    await prisma.userRoleAssignment.create({
      data: { userId: admin.id, roleId: roleRecords.get('ADMIN')!.id },
    });
  }

  console.warn(`Seeded admin ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
