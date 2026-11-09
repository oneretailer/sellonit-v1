import { runSeedScript } from './seed-database.js';
import { seedAdmin } from './seed-admin.js';
import { seedPlans } from './seed-plans.js';
import { seedRolesAndPermissions } from './seed-roles-permissions.js';
import { seedSupplierTransitions } from './seed-supplier-transitions.js';

async function seedAll(): Promise<void> {
  await seedRolesAndPermissions();
  await seedPlans();
  await seedSupplierTransitions();
  await seedAdmin();
  console.warn('Seeded database');
}

void runSeedScript('database', seedAll);
