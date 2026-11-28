import type { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';
import { requireOwnedBusiness } from '../tenancy/tenant.repository.js';
import { productResponse } from './product.response.js';

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('[supplier-product-publish]', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

export async function publishProductHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }

  try {
    const requestedBusinessId = bodyOf(req).businessId ?? req.header('x-business-id');
    if (typeof requestedBusinessId !== 'string' || requestedBusinessId.length === 0) {
      throw new AuthError('BUSINESS_REQUIRED', 'A supplier business is required', 400);
    }

    const membership = await requireOwnedBusiness(req.userId, requestedBusinessId);
    if (membership.business.type !== 'SUPPLIER') {
      throw new AuthError('NOT_A_SUPPLIER', 'This business is not a supplier business', 403);
    }

    const productId = req.params.productId;
    if (typeof productId !== 'string' || productId.length === 0) {
      throw new AuthError('NOT_FOUND', 'Product was not found', 404);
    }
    const result = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId, businessId: requestedBusinessId },
        include: {
          variants: true,
          pricingRule: true,
          business: { include: { supplierProfile: true } },
        },
      });
      if (!product) throw new AuthError('NOT_FOUND', 'Product was not found', 404);

      if (product.business.supplierProfile?.status !== 'APPROVED') {
        throw new AuthError(
          'SUPPLIER_NOT_APPROVED',
          'Your supplier account must be approved before publishing.',
          403,
        );
      }
      if (product.status !== 'DRAFT') {
        throw new AuthError(
          'INVALID_STATE_TRANSITION',
          'Only draft products can be published',
          409,
        );
      }

      const variant = product.variants.find(
        (candidate) => candidate.sku.trim().length > 0 && candidate.basePriceKobo > 0n,
      );
      if (!variant) {
        throw new AuthError(
          'VALIDATION_ERROR',
          'A product must have a variant with a SKU and base price above zero',
          422,
        );
      }

      const warehouse = await transaction.warehouse.findFirst({
        where: { businessId: requestedBusinessId, isDefault: true },
      });
      if (!warehouse) {
        throw new AuthError(
          'DEFAULT_WAREHOUSE_REQUIRED',
          'A default warehouse is required to publish',
          422,
        );
      }

      const published = await transaction.product.update({
        where: { id: product.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
        include: { variants: true, pricingRule: true },
      });
      await transaction.auditLog.create({
        data: {
          businessId: requestedBusinessId,
          actorUserId: req.userId!,
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'PUBLISHED',
        },
      });
      return published;
    });

    res.status(200).json({ data: productResponse(result) });
  } catch (error) {
    sendError(res, error);
  }
}
