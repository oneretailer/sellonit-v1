import type { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';
import { requireBusinessMembership } from '../tenancy/tenant.repository.js';
import { supplierApprovalService } from './supplier-approval.service.js';

const profileFields = [
  'legalName',
  'description',
  'contactPhone',
  'originLocation',
  'retailerAccess',
] as const;

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

function profileData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of profileFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (
    data.retailerAccess !== undefined &&
    (typeof data.retailerAccess !== 'string' ||
      !['OPEN', 'APPROVAL_REQUIRED', 'PRIVATE'].includes(data.retailerAccess))
  ) {
    throw new AuthError('VALIDATION_ERROR', 'Invalid retailer access value', 400);
  }
  for (const field of ['legalName', 'description', 'contactPhone']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      throw new AuthError('VALIDATION_ERROR', `${field} must be a string`, 400);
    }
  }
  return data;
}

async function businessIdForRequest(req: Request): Promise<string> {
  const requested = req.params.businessId ?? bodyOf(req).businessId;
  if (typeof requested === 'string' && requested.length > 0) {
    const membership = await requireBusinessMembership(req.userId!, requested);
    if (membership.business.type !== 'SUPPLIER') {
      throw new AuthError('NOT_A_SUPPLIER', 'This business is not a supplier business', 403);
    }
    return requested;
  }
  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.userId!,
      role: { in: ['OWNER', 'MANAGER'] },
      business: { type: 'SUPPLIER' },
    },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw new AuthError('BUSINESS_REQUIRED', 'Create a business first', 400);
  return membership.businessId;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('[supplier-profile]', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

export async function getSupplierProfileHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  try {
    const businessId = await businessIdForRequest(req);
    const profile = await prisma.supplierProfile.findUnique({ where: { businessId } });
    res.status(200).json({ data: profile ?? { businessId, status: 'DRAFT' } });
  } catch (error) {
    sendError(res, error);
  }
}

export async function upsertSupplierProfileHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  try {
    const businessId = await businessIdForRequest(req);
    const data = profileData(bodyOf(req));
    const profile = await prisma.supplierProfile.upsert({
      where: { businessId },
      update: data,
      create: { businessId, ...data },
    });
    res.status(200).json({ data: profile });
  } catch (error) {
    sendError(res, error);
  }
}

export async function submitSupplierProfileHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  try {
    const businessId = await businessIdForRequest(req);
    const profile = await supplierApprovalService.submit(businessId, req.userId);
    res.status(200).json({ data: profile });
  } catch (error) {
    sendError(res, error);
  }
}
