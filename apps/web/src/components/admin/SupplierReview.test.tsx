/** @vitest-environment jsdom */
import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierReview } from './SupplierReview';
import { polyfillDialog, renderWorkspace } from '@/components/workspace/testUtils';
import { server } from '@/mocks/server';
import { resetMockData } from '@/mocks/handlers';
import { DEFAULT_MOCK_CONFIG, writeMockConfig } from '@/mocks/scenarios';
import { mockSession } from '@/mocks/data';
const mocks = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({ useSession: () => ({ user: { id: 'admin-user' }, workspace: mockSession(), refreshSession: mocks.refreshSession }) }));
beforeAll(() => { server.listen({ onUnhandledFrame: 'error' }); polyfillDialog(); });
beforeEach(() => { resetMockData(); writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona: 'ADMIN' }); });
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
const baseId = '44444444-4444-4444-8444-44444444444';
describe('supplier review confirmation UI', () => {
  it.each([[0, ['Approve supplier', 'Reject supplier']], [1, ['Suspend supplier']], [2, []], [3, ['Reinstate supplier']], [4, []]] as [number, string[]][])('shows only valid actions for fixture %i', async (index, labels) => {
    writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona: 'ADMIN', supplierStatus: 'PENDING_REVIEW' });
    renderWorkspace(<SupplierReview id={`${baseId}${index}`} />); await screen.findByRole('heading', { name: /Lagos|Abuja|Kano|Enugu|Jos/ });
    for (const label of ['Approve supplier', 'Reject supplier', 'Suspend supplier', 'Reinstate supplier']) expect(screen.queryByRole('button', { name: label }) !== null).toBe(labels.includes(label));
  });
  it('requires confirmation, sends selected plan, updates history and announces success', async () => {
    const user = userEvent.setup(); renderWorkspace(<SupplierReview id={`${baseId}0`} />);
    await user.click(await screen.findByRole('button', { name: 'Approve supplier' }));
    expect(screen.getByRole('dialog')).toBeTruthy(); expect(screen.getByText('PENDING REVIEW')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Approval plan'), 'ENTERPRISE_PLUS');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve supplier' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('ENTERPRISE PLUS')).toBeTruthy();
    expect(screen.getByText(/Platform administrator/)).toBeTruthy();
    expect(screen.getByText('Supplier approved.')).toBeTruthy();
  });
  it('keeps a required reason beside its input', async () => {
    const user = userEvent.setup(); renderWorkspace(<SupplierReview id={`${baseId}0`} />);
    await user.click(await screen.findByRole('button', { name: 'Reject supplier' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject supplier' }));
    expect(screen.getByLabelText('Reason (required)').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText('A reason is required.').length).toBeGreaterThan(0);
  });
});
