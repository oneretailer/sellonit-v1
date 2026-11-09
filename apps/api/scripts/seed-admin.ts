import bcrypt from 'bcrypt';
import { isMainModule, prisma, runSeedScript } from './seed-database.js';

export async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@sellonit.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminRole = await prisma.role.findUnique({ where: { key: 'ADMIN' }, select: { id: true } });
  if (!adminRole) throw new Error('ADMIN role is missing; run seed-roles-permissions first');

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
    where: { userId: admin.id, roleId: adminRole.id, businessId: null },
    select: { id: true },
  });
  if (!assignment) {
    await prisma.userRoleAssignment.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });
  }
  console.warn(`Seeded admin ${email}`);
}

if (isMainModule(import.meta.url)) void runSeedScript('admin account', seedAdmin);
