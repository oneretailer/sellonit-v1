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
    profile: { businessId: 'sup-1' },
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
  it('loads a supplier and shows only status-valid actions', async () => {
    vi.spyOn(adminApi, 'getSupplier').mockResolvedValue(supplier());
    renderWorkspace(<SupplierReview id="sup-1" />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Okechukwu Fashion' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Approve supplier' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject supplier' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suspend supplier' })).toBeNull();
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
