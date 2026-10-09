import type { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createBusinessHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId || typeof req.body?.name !== 'string' || req.body.name.trim().length < 2) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'A business name is required' } });
    return;
  }
  const name = req.body.name.trim();
  const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const business = await prisma.business.create({
    data: {
      name,
      slug,
      ownerId: req.userId,
      memberships: { create: { userId: req.userId, role: 'OWNER' } },
    },
    include: { memberships: true },
  });
  res.status(201).json({ data: business });
}

export async function listBusinessesHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
  const businesses = await prisma.business.findMany({
    where: { memberships: { some: { userId: req.userId } } },
    include: { memberships: true },
  });
  res.status(200).json({ data: businesses });
}
