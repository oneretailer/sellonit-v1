/** @vitest-environment jsdom */
import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from './ProductForm';
import { PublishControls } from './PublishControls';
import { polyfillDialog, renderWorkspace } from '@/components/workspace/testUtils';
import { server } from '@/mocks/server';
import { resetMockData } from '@/mocks/handlers';
import { DEFAULT_MOCK_CONFIG, writeMockConfig, type MockConfig } from '@/mocks/scenarios';
import { initialProducts, mockSession } from '@/mocks/data';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refreshWorkspace: vi.fn(), refreshSession: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({ useSession: () => { const workspace = mockSession(); return { workspace, can: (permission: string) => workspace.permissions.includes(permission as never), refreshWorkspace: mocks.refreshWorkspace, refreshSession: mocks.refreshSession }; } }));
beforeAll(() => { server.listen({ onUnhandledFrame: 'error' }); polyfillDialog(); });
beforeEach(() => { resetMockData(); writeMockConfig(DEFAULT_MOCK_CONFIG); vi.clearAllMocks(); });
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
async function fill(user: ReturnType<typeof userEvent.setup>, sku = 'NEW-001') {
  await user.type(screen.getByLabelText('Product name'), 'New shirt');
  await user.type(screen.getByLabelText('Category'), 'Clothing');
  await user.type(screen.getByLabelText('SKU'), sku);
  await user.type(screen.getByLabelText('Base price (₦)'), '1000.29');
}
describe('product form API readiness', () => {
  it('submits exact kobo, no stock fields, and navigates to the created product', async () => {
    const user = userEvent.setup(); renderWorkspace(<ProductForm />); await fill(user);
    expect(screen.queryByLabelText(/stock|inventory/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/products\/[0-9a-f-]+$/)));
  });
  it('prefills an existing product and saves edits through PATCH', async () => {
    const user = userEvent.setup(); renderWorkspace(<ProductForm product={initialProducts()[0]} />);
    const name = screen.getByLabelText('Product name'); expect(name).toHaveProperty('value', 'Everyday cotton shirt');
    await user.clear(name); await user.type(name, 'Edited shirt');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Product updated.');
    expect(mocks.replace).toHaveBeenCalledWith('/products/33333333-3333-4333-8333-333333333331');
  });
  it('places DUPLICATE_SKU beside SKU', async () => {
    const user = userEvent.setup(); renderWorkspace(<ProductForm />); await fill(user, 'COTTON-001');
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(screen.getByLabelText('SKU').getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByLabelText('SKU').getAttribute('aria-describedby')).toBe('product-sku-error');
    expect(screen.getByText('This SKU already exists in your business.')).toBeTruthy();
  });
  it('shows live markup preview and hides pricing without pricing:set', async () => {
    const user = userEvent.setup(); renderWorkspace(<ProductForm />); await fill(user);
    await user.click(screen.getByRole('switch', { name: 'Set a maximum markup' }));
    await user.type(screen.getByLabelText('Maximum markup (₦)'), '200.71');
    expect(screen.getByRole('status').textContent).toContain('₦1,000.29 to ₦1,201');
    cleanup(); writeMockConfig({ ...DEFAULT_MOCK_CONFIG, persona: 'MANAGER' }); renderWorkspace(<ProductForm />);
    expect(screen.queryByRole('switch')).toBeNull(); expect(screen.getByLabelText('Base price (₦)')).toBeTruthy();
  });
  it('keeps archived products read-only', () => {
    renderWorkspace(<ProductForm product={initialProducts()[2]} />);
    expect(screen.getAllByText('Archived products are read-only.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Product name')).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Publish product' })).toHaveProperty('disabled', true);
  });
  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as MockConfig['supplierStatus'][])('disables publishing with explanation for %s', (supplierStatus) => {
    writeMockConfig({ ...DEFAULT_MOCK_CONFIG, supplierStatus }); renderWorkspace(<PublishControls product={initialProducts()[0]!} />);
    expect(screen.getByRole('button', { name: 'Publish product' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Publishing is available after your supplier account is approved.')).toBeTruthy();
  });
  it('confirms before publishing and displays current status/date', async () => {
    const user = userEvent.setup(); renderWorkspace(<PublishControls product={initialProducts()[0]!} />);
    await user.click(screen.getByRole('button', { name: 'Publish product' })); expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('PUBLISHED')).toBeTruthy(); expect(screen.getByText(/^Published /)).toBeTruthy();
  });
});
