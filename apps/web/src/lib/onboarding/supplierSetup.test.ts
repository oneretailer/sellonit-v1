import { describe, expect, it } from 'vitest';
import type { OnboardingBusinessDraft } from '@/lib/auth/flowState';
import { SUPPLIER_SETUP_STEPS, computeSupplierSetupProgress } from './supplierSetup';

const draft: OnboardingBusinessDraft = {
  name: 'Okechukwu Fashion',
  phone: '08031234567',
  email: 'hello@example.com',
  description: 'Fashion retailer',
  completedAt: '2026-10-26T00:00:00.000Z',
};

describe('supplier setup checklist', () => {
  it('defines the six ordered steps with Business information first', () => {
    expect(SUPPLIER_SETUP_STEPS.map((step) => step.label)).toEqual([
      'Business information',
      'Supplier profile',
      'Product catalogue',
      'Inventory',
      'Pricing',
      'Website',
    ]);
    expect(SUPPLIER_SETUP_STEPS[0].id).toBe('business-information');
  });

  it('reports 0 of 6 with no backend steps and no business draft', () => {
    const progress = computeSupplierSetupProgress([], null);
    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(6);
    expect(progress.percent).toBe(0);
    expect(progress.nextStep?.id).toBe('business-information');
    expect(progress.steps.every((step) => !step.complete)).toBe(true);
  });

  it('marks Business information complete from server supplier business even when sessionStorage draft is empty', () => {
    const progress = computeSupplierSetupProgress([], null, {
      hasServerSupplierBusiness: true,
      supplierProfile: { businessId: 'biz-1', status: 'DRAFT' },
    });
    expect(progress.completed).toBe(1);
    expect(progress.percent).toBe(17);
    expect(progress.steps[0]!.complete).toBe(true);
    expect(progress.steps[1]!.complete).toBe(false);
    expect(progress.nextStep?.id).toBe('supplier-profile');
  });

  it('marks Supplier profile complete once submitted (PENDING_REVIEW or APPROVED → 2 of 6 = 33%)', () => {
    const progress = computeSupplierSetupProgress([], null, {
      hasServerSupplierBusiness: true,
      supplierProfile: { businessId: 'biz-1', status: 'PENDING_REVIEW' },
    });
    expect(progress.completed).toBe(2);
    expect(progress.percent).toBe(33);
    expect(progress.steps[0]!.complete).toBe(true);
    expect(progress.steps[1]!.complete).toBe(true);
    expect(progress.nextStep?.id).toBe('product-catalogue');
  });

  it('marks Business information complete from the Create Business draft (1 of 6 ≈ 17%)', () => {
    const progress = computeSupplierSetupProgress([], draft);
    expect(progress.completed).toBe(1);
    expect(percent(progress.completed, progress.total)).toBe(17);
    expect(progress.percent).toBe(17);
    expect(progress.steps[0]!.complete).toBe(true);
    expect(progress.nextStep?.id).toBe('supplier-profile');
  });

  it('merges backend ids with the draft, de-duplicates and ignores unknown ids', () => {
    const progress = computeSupplierSetupProgress(
      ['supplier-profile', 'supplier-profile', 'inventory', 'not-a-step'],
      draft,
    );
    expect(progress.completed).toBe(3);
    expect(progress.percent).toBe(50);
    expect(progress.nextStep?.id).toBe('product-catalogue');
  });

  it('reports 100% and no next step when everything is complete', () => {
    const progress = computeSupplierSetupProgress(
      SUPPLIER_SETUP_STEPS.map((step) => step.id),
      draft,
    );
    expect(progress.completed).toBe(6);
    expect(progress.percent).toBe(100);
    expect(progress.nextStep).toBeNull();
    expect(progress.steps.every((step) => step.complete)).toBe(true);
  });
});

function percent(completed: number, total: number): number {
  return Math.round((completed / total) * 100);
}
