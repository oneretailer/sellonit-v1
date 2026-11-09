import { isMainModule, prisma, runSeedScript } from './seed-database.js';

export async function seedPlans(): Promise<void> {
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

  await prisma.planTransition.upsert({
    where: {
      fromPlanId_toPlanId: {
        fromPlanId: planRecords.get('ENTERPRISE')!.id,
        toPlanId: planRecords.get('ENTERPRISE_PLUS')!.id,
      },
    },
    update: {},
    create: {
      fromPlanId: planRecords.get('ENTERPRISE')!.id,
      toPlanId: planRecords.get('ENTERPRISE_PLUS')!.id,
    },
  });
}

if (isMainModule(import.meta.url)) void runSeedScript('plans and plan transitions', seedPlans);
