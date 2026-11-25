import type { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';
import { requireBusinessMembership, requireOwnedBusiness } from '../tenancy/tenant.repository.js';
import { productResponse } from './product.response.js';

const MAX_SAFE_KOBO = BigInt(Number.MAX_SAFE_INTEGER);

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

function requestedBusinessId(req: Request): string {
  const value = req.params.businessId ?? bodyOf(req).businessId ?? req.header('x-business-id');
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuthError('BUSINESS_REQUIRED', 'A supplier business is required', 400);
  }
  return value;
}

function productId(req: Request): string {
  const value = req.params.id;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuthError('NOT_FOUND', 'Product was not found', 404);
  }
  return value;
}

function stringValue(value: unknown, field: string, required = false): string {
  if (typeof value !== 'string' || (required && value.trim().length === 0)) {
    throw new AuthError('VALIDATION_ERROR', `${field} is required`, 422);
  }
  return value.trim();
}

function priceValue(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new AuthError('VALIDATION_ERROR', 'basePriceKobo must be a positive safe integer', 422);
  }
  return BigInt(value);
}

function defaultVariant(body: Record<string, unknown>) {
  if (!body.defaultVariant || typeof body.defaultVariant !== 'object') {
    throw new AuthError('VALIDATION_ERROR', 'defaultVariant is required', 422);
  }
  const variant = body.defaultVariant as Record<string, unknown>;
  return {
    sku: stringValue(variant.sku, 'defaultVariant.sku', true),
    basePriceKobo: priceValue(variant.basePriceKobo),
  };
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if ((error as { code?: string })?.code === 'P2002') {
    res.status(409).json({ error: { code: 'DUPLICATE_SKU', message: 'SKU already exists' } });
    return;
  }
  console.error('[supplier-products]', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

async function assertSupplierAccess(req: Request, write: boolean): Promise<string> {
  const businessId = requestedBusinessId(req);
  const membership = write
    ? await requireOwnedBusiness(req.userId!, businessId)
    : await requireBusinessMembership(req.userId!, businessId);
  if (membership.business.type !== 'SUPPLIER') {
    throw new AuthError('NOT_A_SUPPLIER', 'This business is not a supplier business', 403);
  }
  return businessId;
}

const productInclude = { variants: true, pricingRule: true } as const;

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  try {
    const businessId = await assertSupplierAccess(req, false);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = {
      businessId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { category: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.status(200).json({
      data: products.map(productResponse),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  try {
    const businessId = await assertSupplierAccess(req, true);
    const body = bodyOf(req);
    const name = stringValue(body.name, 'name', true);
    const description =
      body.description === undefined ? '' : stringValue(body.description, 'description');
    const category = body.category === undefined ? '' : stringValue(body.category, 'category');
    const variant = defaultVariant(body);
    const product = await prisma.product.create({
      data: {
        businessId,
        name,
        description,
        category,
        variants: { create: { businessId, ...variant } },
        pricingRule: { create: { maxMarkupKobo: null } },
      },
      include: productInclude,
    });
    res.status(201).json({ data: productResponse(product) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getProductHandler(req: Request, res: Response): Promise<void> {
  try {
    const businessId = await assertSupplierAccess(req, false);
    const product = await prisma.product.findFirst({
      where: { id: productId(req), businessId },
      include: productInclude,
    });
    if (!product) throw new AuthError('NOT_FOUND', 'Product was not found', 404);
    res.status(200).json({ data: productResponse(product) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  try {
    const businessId = await assertSupplierAccess(req, true);
    const id = productId(req);
    const body = bodyOf(req);
    const current = await prisma.product.findFirst({
      where: { id, businessId },
      include: { variants: true },
    });
    if (!current) throw new AuthError('NOT_FOUND', 'Product was not found', 404);
    if (current.status === 'ARCHIVED')
      throw new AuthError('INVALID_STATE_TRANSITION', 'Archived products are immutable', 409);
    const variant = body.defaultVariant === undefined ? null : defaultVariant(body);
    const updated = await prisma.$transaction(async (transaction) => {
      if (variant) {
        const existing = current.variants[0];
        if (!existing) {
          await transaction.productVariant.create({
            data: { productId: id, businessId, ...variant },
          });
        } else {
          await transaction.productVariant.update({ where: { id: existing.id }, data: variant });
        }
      }
      return transaction.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: stringValue(body.name, 'name', true) } : {}),
          ...(body.description !== undefined
            ? { description: stringValue(body.description, 'description') }
            : {}),
          ...(body.category !== undefined
            ? { category: stringValue(body.category, 'category') }
            : {}),
        },
        include: productInclude,
      });
    });
    res.status(200).json({ data: productResponse(updated) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updatePricingRuleHandler(req: Request, res: Response): Promise<void> {
  try {
    const businessId = await assertSupplierAccess(req, true);
    const id = productId(req);
    const value = bodyOf(req).maxMarkupKobo;
    if (
      value !== null &&
      (typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        BigInt(value) > MAX_SAFE_KOBO)
    ) {
      throw new AuthError(
        'VALIDATION_ERROR',
        'maxMarkupKobo must be null or a non-negative safe integer',
        422,
      );
    }
    const product = await prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new AuthError('NOT_FOUND', 'Product was not found', 404);
    await prisma.pricingRule.upsert({
      where: { productId: id },
      update: { maxMarkupKobo: value === null ? null : BigInt(value as number) },
      create: { productId: id, maxMarkupKobo: value === null ? null : BigInt(value as number) },
    });
    const updated = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
    res.status(200).json({ data: productResponse(updated) });
  } catch (error) {
    sendError(res, error);
  }
}
