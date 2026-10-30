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

function stringField(value: unknown): value is string {
  return typeof value === 'string';
}

function businessTypeField(value: unknown): value is 'RETAILER' | 'ENTREPRENEUR' | 'ENTERPRISE' {
  return value === 'RETAILER' || value === 'ENTREPRENEUR' || value === 'ENTERPRISE';
}

export async function createBusinessHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as unknown;
  const requestName =
    body && typeof body === 'object' ? (body as Record<string, unknown>).name : undefined;
  const requestType =
    body && typeof body === 'object' ? (body as Record<string, unknown>).type : undefined;
  const requestBusinessType =
    body && typeof body === 'object' ? (body as Record<string, unknown>).businessType : undefined;
  const requestedType = requestType ?? requestBusinessType;
  if (!req.userId || !stringField(requestName) || requestName.trim().length < 2) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'A business name is required' } });
    return;
  }
  if (requestedType !== undefined && !businessTypeField(requestedType)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Business type must be RETAILER, ENTREPRENEUR, or ENTERPRISE',
      },
    });
    return;
  }
  const name = requestName.trim();
  const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { onboardingIntent: true },
  });
  const type = requestedType ?? user?.onboardingIntent ?? 'RETAILER';
  const business = await prisma.business.create({
    data: {
      name,
      slug,
      ownerId: req.userId,
      type,
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
