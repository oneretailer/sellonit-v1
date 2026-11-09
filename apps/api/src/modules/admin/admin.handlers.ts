import type { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';
import { supplierApprovalService } from '../suppliers/supplier-approval.service.js';

const reviewStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
const planKeys = ['ENTERPRISE', 'ENTERPRISE_PLUS'] as const;
type ReviewStatus = (typeof reviewStatuses)[number];
type PlanKey = (typeof planKeys)[number];

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

function pathId(req: Request): string {
  const value = req.params.id;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuthError('VALIDATION_ERROR', 'Supplier business ID is required', 422);
  }
  return value;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('[admin-suppliers]', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

function statusOf(value: unknown): ReviewStatus | undefined {
  return typeof value === 'string' && reviewStatuses.includes(value as ReviewStatus)
    ? (value as ReviewStatus)
    : undefined;
}

function planOf(value: unknown): PlanKey | undefined {
  return typeof value === 'string' && planKeys.includes(value as PlanKey)
    ? (value as PlanKey)
    : undefined;
}

function requiredReason(body: Record<string, unknown>): string {
  const reason = body.reason;
  if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 2000) {
    throw new AuthError('VALIDATION_ERROR', 'A non-empty reason is required', 422);
  }
  return reason.trim();
}

function optionalNote(body: Record<string, unknown>): string | null {
  return typeof body.note === 'string' ? body.note.trim() || null : null;
}

async function supplierDetail(businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, type: 'SUPPLIER' },
    include: {
      owner: { select: { firstName: true, lastName: true, email: true, phone: true } },
      supplierProfile: true,
      activeSubscription: { include: { plan: { select: { key: true } } } },
      supplierReviewEvents: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!business || !business.supplierProfile) {
    throw new AuthError('NOT_FOUND', 'Supplier business was not found', 404);
  }
  return {
    id: business.id,
    businessName: business.name,
    ownerName: `${business.owner.firstName} ${business.owner.lastName}`.trim(),
    ownerPhone: business.owner.phone ?? business.phone ?? '',
    ownerEmail: business.owner.email,
    description: business.supplierProfile.description ?? '',
    profile: business.supplierProfile,
    submittedAt: business.supplierProfile.submittedAt,
    status: business.supplierProfile.status,
    plan: business.activeSubscription?.plan.key ?? null,
    auditHistory: business.supplierReviewEvents.map((event) => ({
      id: event.id,
      action: event.action,
      actorName: `${event.actor.firstName} ${event.actor.lastName}`.trim(),
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
  };
}

export async function listAdminSuppliersHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = statusOf(req.query.status) ?? 'PENDING_REVIEW';
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = {
      type: 'SUPPLIER' as const,
      supplierProfile: {
        status,
        ...(search
          ? {
              OR: [
                { legalName: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };
    const [businesses, total] = await prisma.$transaction([
      prisma.business.findMany({
        where,
        include: { owner: { select: { phone: true } }, supplierProfile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.business.count({ where }),
    ]);
    res.status(200).json({
      data: businesses.map((business) => ({
        id: business.id,
        businessName: business.name,
        ownerPhone: business.owner.phone ?? business.phone ?? '',
        submittedAt: business.supplierProfile!.submittedAt,
        status: business.supplierProfile!.status,
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getAdminSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ data: await supplierDetail(pathId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function approveAdminSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const plan = planOf(bodyOf(req).plan);
    if (!plan)
      throw new AuthError('VALIDATION_ERROR', 'Plan must be ENTERPRISE or ENTERPRISE_PLUS', 422);
    const id = pathId(req);
    if (!req.userId) throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    await supplierApprovalService.approve(id, req.userId, plan, optionalNote(bodyOf(req)));
    res.status(200).json({ data: await supplierDetail(id) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function rejectAdminSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = pathId(req);
    if (!req.userId) throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    await supplierApprovalService.reject(id, req.userId, requiredReason(bodyOf(req)));
    res.status(200).json({ data: await supplierDetail(id) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function suspendAdminSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = pathId(req);
    if (!req.userId) throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    await supplierApprovalService.suspend(id, req.userId, requiredReason(bodyOf(req)));
    res.status(200).json({ data: await supplierDetail(id) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function reinstateAdminSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = pathId(req);
    if (!req.userId) throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    await supplierApprovalService.reinstate(id, req.userId);
    res.status(200).json({ data: await supplierDetail(id) });
  } catch (error) {
    sendError(res, error);
  }
}
