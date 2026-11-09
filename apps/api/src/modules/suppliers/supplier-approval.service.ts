import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';
import { publishSupplierEvent } from './supplier.events.js';
import type {
  Prisma,
  SupplierProfileStatus,
  SupplierReviewAction,
} from '../../generated/prisma/client.js';

type ApprovalPlan = 'ENTERPRISE' | 'ENTERPRISE_PLUS';
type TransitionAction = Exclude<SupplierReviewAction, 'SUBMITTED'>;

const actionTargets: Record<TransitionAction, SupplierProfileStatus> = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  REINSTATED: 'APPROVED',
};

export class SupplierApprovalService {
  async submit(businessId: string, actorUserId: string) {
    const result = await prisma.$transaction(async (transaction) => {
      await this.lockProfile(transaction, businessId);
      const profile = await transaction.supplierProfile.findUnique({ where: { businessId } });
      if (!profile)
        throw new AuthError('PROFILE_REQUIRED', 'Save the supplier profile before submitting', 400);
      await this.assertTransition(transaction, profile.status, 'PENDING_REVIEW');
      const updated = await transaction.supplierProfile.update({
        where: { businessId },
        data: {
          status: 'PENDING_REVIEW',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      await transaction.supplierReviewEvent.create({
        data: {
          businessId,
          actorUserId,
          action: 'SUBMITTED',
          fromStatus: profile.status,
          toStatus: 'PENDING_REVIEW',
        },
      });
      return updated;
    });
    publishSupplierEvent({ type: 'supplier.submitted', businessId, actorUserId });
    return result;
  }

  async approve(
    businessId: string,
    actorUserId: string,
    plan: ApprovalPlan,
    reason: string | null = null,
  ) {
    return this.transition(businessId, actorUserId, 'APPROVED', reason, plan);
  }

  async reject(businessId: string, actorUserId: string, reason: string) {
    return this.transition(businessId, actorUserId, 'REJECTED', reason, null);
  }

  async suspend(businessId: string, actorUserId: string, reason: string) {
    return this.transition(businessId, actorUserId, 'SUSPENDED', reason, null);
  }

  async reinstate(businessId: string, actorUserId: string) {
    return this.transition(businessId, actorUserId, 'REINSTATED', null, null);
  }

  private async transition(
    businessId: string,
    actorUserId: string,
    action: TransitionAction,
    reason: string | null,
    plan: ApprovalPlan | null,
  ) {
    const result = await prisma.$transaction(async (transaction) => {
      await this.lockProfile(transaction, businessId);
      const profile = await transaction.supplierProfile.findUnique({ where: { businessId } });
      if (!profile) throw new AuthError('NOT_FOUND', 'Supplier business was not found', 404);
      const nextStatus = actionTargets[action];
      await this.assertTransition(transaction, profile.status, nextStatus);
      if (action === 'APPROVED') {
        if (!plan) throw new AuthError('VALIDATION_ERROR', 'A plan is required for approval', 422);
        const selectedPlan = await transaction.plan.findUnique({ where: { key: plan } });
        if (!selectedPlan)
          throw new AuthError('PLAN_NOT_FOUND', 'Selected plan was not found', 422);
        await transaction.businessSubscription.upsert({
          where: { businessId },
          update: { planId: selectedPlan.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null },
          create: { businessId, planId: selectedPlan.id },
        });
      }
      const now = new Date();
      const updated = await transaction.supplierProfile.update({
        where: { businessId },
        data: { status: nextStatus, reviewedAt: now, reviewedByUserId: actorUserId },
      });
      if (action === 'SUSPENDED') {
        await transaction.business.update({
          where: { id: businessId },
          data: { status: 'SUSPENDED' },
        });
      } else if (action === 'REINSTATED') {
        await transaction.business.update({
          where: { id: businessId },
          data: { status: 'ACTIVE' },
        });
      }
      await transaction.supplierReviewEvent.create({
        data: {
          businessId,
          actorUserId,
          action,
          fromStatus: profile.status,
          toStatus: nextStatus,
          reason,
        },
      });
      return updated;
    });
    publishSupplierEvent({
      type: `supplier.${action.toLowerCase()}` as
        'supplier.approved' | 'supplier.rejected' | 'supplier.suspended' | 'supplier.reinstated',
      businessId,
      actorUserId,
    });
    return result;
  }

  private async lockProfile(
    transaction: Prisma.TransactionClient,
    businessId: string,
  ): Promise<void> {
    await transaction.$queryRaw`SELECT "id" FROM "SupplierProfile" WHERE "businessId" = ${businessId} FOR UPDATE`;
  }

  private async assertTransition(
    transaction: Prisma.TransactionClient,
    fromStatus: SupplierProfileStatus,
    toStatus: SupplierProfileStatus,
  ): Promise<void> {
    const transition = await transaction.supplierStatusTransition.findUnique({
      where: { fromStatus_toStatus: { fromStatus, toStatus } },
    });
    if (!transition) {
      throw new AuthError(
        'INVALID_STATE_TRANSITION',
        `Supplier cannot move from ${fromStatus} to ${toStatus}`,
        409,
      );
    }
  }
}

export const supplierApprovalService = new SupplierApprovalService();
