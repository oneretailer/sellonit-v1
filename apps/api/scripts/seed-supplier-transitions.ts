import { isMainModule, prisma, runSeedScript } from './seed-database.js';

const transitions = [
  ['DRAFT', 'PENDING_REVIEW'],
  ['PENDING_REVIEW', 'APPROVED'],
  ['PENDING_REVIEW', 'REJECTED'],
  ['APPROVED', 'SUSPENDED'],
  ['SUSPENDED', 'APPROVED'],
] as const;

export async function seedSupplierTransitions(): Promise<void> {
  for (const [fromStatus, toStatus] of transitions) {
    await prisma.supplierStatusTransition.upsert({
      where: { fromStatus_toStatus: { fromStatus, toStatus } },
      update: {},
      create: { fromStatus, toStatus },
    });
  }
}

if (isMainModule(import.meta.url))
  void runSeedScript('supplier status transitions', seedSupplierTransitions);
