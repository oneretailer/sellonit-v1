/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBusinessForm } from './CreateBusinessForm';
import { clearOnboardingBusiness, clearOnboardingRole } from '@/lib/auth/flowState';
import { getActiveBusinessId } from '@/lib/business/activeBusiness';
import type { SwitcherBusiness } from '@/lib/business/businessesApi';
import { businessApi } from '@/lib/onboarding/businessApi';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  createBusiness: vi.fn(),
  user: null as { id?: string; firstName: string; onboardingIntent: string | null } | null,
  listBusinesses: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/lib/workspace/api', () => ({ confirmIdentity: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/business/businessesApi', () => ({
  listBusinesses: () => mocks.listBusinesses() as Promise<SwitcherBusiness[]>,
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({ user: mocks.user }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingRole();
  clearOnboardingBusiness();
  mocks.user = { id: 'user-1', firstName: 'Ada', onboardingIntent: 'SUPPLIER' };
  mocks.listBusinesses.mockResolvedValue([]);
  // Keep the real feature flag / canCreateBusiness; only stub the adapter method.
  vi.spyOn(businessApi, 'createBusiness').mockImplementation(mocks.createBusiness);
  mocks.createBusiness.mockResolvedValue({ id: 'biz-1', name: 'Okechukwu Fashion', type: 'SUPPLIER' });
});

async function fillValidForm(props: { mode?: 'onboarding' | 'add' } = {}) {
  const user = userEvent.setup();
  render(<CreateBusinessForm {...props} />);
  await user.type(screen.getByLabelText('Business name'), 'Okechukwu Fashion');
  await user.type(screen.getByLabelText('Business phone number'), '08031234567');
  await user.type(screen.getByLabelText('Business email'), 'hello@example.com');
  return user;
}

describe('Create Business screen', () => {
  it('renders the heading, subtext, all four fields and a disabled submit until valid', () => {
    render(<CreateBusinessForm />);
    expect(screen.getByRole('heading', { name: 'Create your business' })).toBeTruthy();
    expect(screen.getByText('Set up your business account on sellonit')).toBeTruthy();
    expect(screen.getByLabelText('Business name')).toBeTruthy();
    expect(screen.getByLabelText('Business phone number')).toBeTruthy();
    expect(screen.getByLabelText('Business email')).toBeTruthy();
    expect(screen.getByLabelText('Business description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Business' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Join an existing business' })).toBeTruthy();
  });

  it('greets with the backend first name and falls back to nothing when absent', () => {
    const { rerender } = render(<CreateBusinessForm />);
    expect(screen.getByText('Welcome, Ada')).toBeTruthy();
    mocks.user = { id: 'user-1', firstName: '   ', onboardingIntent: 'SUPPLIER' };
    rerender(<CreateBusinessForm />);
    expect(screen.queryByText(/Welcome,/)).toBeNull();
  });

  it('shows Nigerian phone and email errors on blur, not on each keystroke', async () => {
    const user = userEvent.setup();
    render(<CreateBusinessForm />);
    const phone = screen.getByLabelText('Business phone number');
    await user.type(phone, '12345');
    expect(screen.queryByText('Invalid phone number')).toBeNull();
    await user.tab();
    expect(screen.getByText('Invalid phone number')).toBeTruthy();

    const email = screen.getByLabelText('Business email');
    await user.type(email, 'not-an-email');
    expect(screen.queryByText('Invalid email')).toBeNull();
    await user.tab();
    expect(screen.getByText('Invalid email')).toBeTruthy();
  });

  it('accepts a +234 international phone number', async () => {
    const user = userEvent.setup();
    render(<CreateBusinessForm />);
    await user.type(screen.getByLabelText('Business name'), 'Okechukwu Fashion');
    const phone = screen.getByLabelText('Business phone number');
    await user.type(phone, '+2348031234567');
    await user.tab();
    expect(screen.queryByText('Invalid phone number')).toBeNull();
  });

  it('lets a supplier submit, sets active business, and advances to dashboard overview', async () => {
    const user = await fillValidForm();
    const submit = screen.getByRole('button', { name: 'Create Business' });
    expect(submit).toHaveProperty('disabled', false);
    await user.click(submit);
    await waitFor(() => expect(mocks.createBusiness).toHaveBeenCalled());
    expect(mocks.createBusiness.mock.calls[0]![0]).toMatchObject({
      name: 'Okechukwu Fashion',
      phone: '08031234567',
      email: 'hello@example.com',
      role: 'supplier',
    });
    expect(getActiveBusinessId()).toBe('biz-1');
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
  });

  it('preflights existing membership via GET /businesses and skips duplicate initial signup', async () => {
    mocks.listBusinesses.mockResolvedValue([
      { id: 'existing-business', name: 'Existing', type: 'SUPPLIER', status: 'ACTIVE', role: 'OWNER', plan: null },
    ]);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.createBusiness).not.toHaveBeenCalled();
  });

  it('creates an additional business in mode="add" even when businesses already exist', async () => {
    mocks.listBusinesses.mockResolvedValue([
      { id: 'existing-business', name: 'Existing', type: 'SUPPLIER', status: 'ACTIVE', role: 'OWNER', plan: null },
    ]);
    mocks.createBusiness.mockResolvedValue({ id: 'biz-2', name: 'Second Co', type: 'SUPPLIER' });
    const user = await fillValidForm({ mode: 'add' });
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    await waitFor(() => expect(mocks.createBusiness).toHaveBeenCalledTimes(1));
    expect(getActiveBusinessId()).toBe('biz-2');
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
  });

  it('reuses the same idempotency key when retrying a failed submit', async () => {
    const user = await fillValidForm();
    mocks.createBusiness.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    await waitFor(() => expect(mocks.createBusiness).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    await waitFor(() => expect(mocks.createBusiness).toHaveBeenCalledTimes(2));
    expect(mocks.createBusiness.mock.calls[0]![1]).toBeTruthy();
    expect(mocks.createBusiness.mock.calls[1]![1]).toBe(mocks.createBusiness.mock.calls[0]![1]);
  });

  it('shows a non-blocking coming-soon notice for non-supplier roles and does not advance', async () => {
    mocks.user = { id: 'user-1', firstName: 'Ada', onboardingIntent: 'RETAILER' };
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('treats the Join an existing business footer as a coming-soon placeholder', async () => {
    const user = userEvent.setup();
    render(<CreateBusinessForm />);
    await user.click(screen.getByRole('button', { name: 'Join an existing business' }));
    expect(await screen.findByText(/Joining an existing business is coming soon/i)).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
