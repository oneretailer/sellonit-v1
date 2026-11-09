/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierReview } from './SupplierReview';
import { polyfillDialog, renderWorkspace } from '@/components/workspace/testUtils';
import { ApiError } from '@/lib/api-client';
import * as adminApi from '@/lib/workspace/adminApi';
import type { SupplierDetail } from '@/lib/workspace/types';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useSession: () => ({
    user: { id: 'admin-1' },
    refreshSession: vi.fn(() => Promise.resolve(null)),
  }),
}));

function supplier(overrides: Partial<SupplierDetail> = {}): SupplierDetail {
  return {
    id: 'sup-1',
    businessName: 'Okechukwu Fashion',
    ownerName: 'Ada Lovelace',
    ownerPhone: '08031234567',
    ownerEmail: 'ada@example.com',
    description: 'Fashion wholesaler',
    profile: {
      businessId: 'sup-1',
      status: 'PENDING_REVIEW',
      legalName: 'Okechukwu Fashion Ltd',
      contactPhone: '+2348031234567',
      retailerAccess: 'APPROVAL_REQUIRED',
      description: 'Wholesale textiles and ready-to-wear garments across Lagos.',
      originLocation: {
        recipientName: 'Okechukwu Fashion Ltd',
        phone: '+2348031234567',
        addressLine1: '12 Marina Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'NG',
      },
    },
    status: 'PENDING_REVIEW',
    plan: null,
    submittedAt: '2026-10-26T00:00:00.000Z',
    auditHistory: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => polyfillDialog());

describe('supplier review (spied API, no mocks server)', () => {
  it('loads a supplier, displays verification profile fields, and shows only status-valid actions', async () => {
    vi.spyOn(adminApi, 'getSupplier').mockResolvedValue(supplier());
    renderWorkspace(<SupplierReview id="sup-1" />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Okechukwu Fashion' })).toBeTruthy(),
    );
    expect(screen.getByText('Okechukwu Fashion Ltd')).toBeTruthy();
    expect(screen.getByText('+2348031234567')).toBeTruthy();
    expect(screen.getByText('Approval required')).toBeTruthy();
    expect(screen.getByText('12 Marina Road, Lagos, Lagos, NG')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve supplier' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject supplier' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suspend supplier' })).toBeNull();
  });

  it('approves a pending supplier with selected plan and optional audit note', async () => {
    const userEventSession = userEvent.setup();
    const approvedSupplier = supplier({
      status: 'APPROVED',
      plan: 'ENTERPRISE_PLUS',
      profile: { businessId: 'sup-1', status: 'APPROVED' },
      auditHistory: [
        {
          id: 'evt-1',
          action: 'APPROVED',
          actorName: 'Sellonit Admin',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'APPROVED',
          reason: 'CAC & dispatch address verified',
          createdAt: '2026-11-05T12:00:00.000Z',
        },
      ],
    });
    vi.spyOn(adminApi, 'getSupplier')
      .mockResolvedValueOnce(supplier())
      .mockResolvedValue(approvedSupplier);
    const transition = vi
      .spyOn(adminApi, 'transitionSupplier')
      .mockResolvedValue(approvedSupplier);

    renderWorkspace(<SupplierReview id="sup-1" />);
    await userEventSession.click(await screen.findByRole('button', { name: 'Approve supplier' }));
    await userEventSession.selectOptions(screen.getByLabelText('Approval plan'), 'ENTERPRISE_PLUS');
    await userEventSession.type(
      screen.getByLabelText('Approval note (optional)'),
      'CAC & dispatch address verified',
    );
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve supplier' });
    await userEventSession.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() =>
      expect(transition).toHaveBeenCalledWith('sup-1', 'approve', {
        reason: '',
        plan: 'ENTERPRISE_PLUS',
        note: 'CAC & dispatch address verified',
      }),
    );
    expect((await screen.findAllByText('APPROVED')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ENTERPRISE PLUS')).toBeTruthy();
    expect(screen.getByText('CAC & dispatch address verified')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suspend supplier' })).toBeTruthy();
  });

  it('requires a reason before rejecting and calls the real API adapter', async () => {
    const userEventSession = userEvent.setup();
    vi.spyOn(adminApi, 'getSupplier').mockResolvedValue(supplier());
    const transition = vi
      .spyOn(adminApi, 'transitionSupplier')
      .mockResolvedValue(supplier({ status: 'REJECTED' }));
    renderWorkspace(<SupplierReview id="sup-1" />);
    await userEventSession.click(await screen.findByRole('button', { name: 'Reject supplier' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    // Confirm without a reason → inline error, no API call.
    const confirmButtons = screen.getAllByRole('button', { name: 'Reject supplier' });
    await userEventSession.click(confirmButtons[confirmButtons.length - 1]!);
    expect((await screen.findAllByText('A reason is required.')).length).toBeGreaterThan(0);
    expect(transition).not.toHaveBeenCalled();
    await userEventSession.type(screen.getByLabelText('Reason (required)'), 'Incomplete documents');
    await userEventSession.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() =>
      expect(transition).toHaveBeenCalledWith('sup-1', 'reject', {
        reason: 'Incomplete documents',
        plan: 'ENTERPRISE',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('surfaces load errors with a retry that refetches', async () => {
    const userEventSession = userEvent.setup();
    const get = vi
      .spyOn(adminApi, 'getSupplier')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'Something went wrong.'))
      .mockResolvedValue(supplier());
    renderWorkspace(<SupplierReview id="sup-1" />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    await userEventSession.click(retry);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Okechukwu Fashion' })).toBeTruthy(),
    );
    expect(get).toHaveBeenCalledTimes(2);
  });
});
