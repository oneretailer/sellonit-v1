import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const rootEnvFile = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database');

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export function isMainModule(moduleUrl: string): boolean {
  return (
    process.argv[1] !== undefined && resolve(fileURLToPath(moduleUrl)) === resolve(process.argv[1])
  );
}

export async function runSeedScript(name: string, seed: () => Promise<void>): Promise<void> {
  try {
    await seed();
    console.warn(`Completed ${name}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
