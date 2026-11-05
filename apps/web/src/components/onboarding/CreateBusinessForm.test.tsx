/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBusinessForm } from './CreateBusinessForm';
import { clearOnboardingBusiness, clearOnboardingRole } from '@/lib/auth/flowState';
import { businessApi } from '@/lib/onboarding/businessApi';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  createBusiness: vi.fn(),
  user: null as { firstName: string; onboardingIntent: string | null } | null,
  context: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/lib/workspace/api', () => ({ confirmIdentity: vi.fn().mockResolvedValue(true), getSessionContext: () => mocks.context() as Promise<{ businesses: { id: string }[] }> }));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({ user: mocks.user, refreshWorkspace: vi.fn().mockResolvedValue(null) }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clearOnboardingRole();
  clearOnboardingBusiness();
  mocks.user = { firstName: 'Ada', onboardingIntent: 'ENTERPRISE' };
  mocks.context.mockResolvedValue({ businesses: [] });
  // Keep the real feature flag / canCreateBusiness; only stub the adapter method.
  vi.spyOn(businessApi, 'createBusiness').mockImplementation(mocks.createBusiness);
  mocks.createBusiness.mockResolvedValue({ id: 'biz-1', name: 'Okechukwu Fashion', type: 'ENTERPRISE' });
});

async function fillValidForm() {
  const user = userEvent.setup();
  render(<CreateBusinessForm />);
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
    mocks.user = { firstName: '   ', onboardingIntent: 'ENTERPRISE' };
    rerender(<CreateBusinessForm />);
    expect(screen.queryByText(/Welcome,/)).toBeNull();
  });

  it('shows Nigerian phone and email errors on blur, not on each keystroke', async () => {
    const user = userEvent.setup();
    render(<CreateBusinessForm />);
    const phone = screen.getByLabelText('Business phone number');
    await user.type(phone, '12345');
    // Not validated while typing (before blur).
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

  it('lets a supplier submit and advance to the dashboard', async () => {
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
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('preflights existing membership and skips duplicate signup submission', async () => {
    mocks.context.mockResolvedValue({ businesses: [{ id: 'existing-business' }] });
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create Business' }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.createBusiness).not.toHaveBeenCalled();
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
    mocks.user = { firstName: 'Ada', onboardingIntent: 'RETAILER' };
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
