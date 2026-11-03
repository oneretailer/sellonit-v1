/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierSetupScreen } from './SupplierSetupScreen';
import {
  clearOnboardingBusiness,
  writeOnboardingBusiness,
} from '@/lib/auth/flowState';
import { SUPPLIER_SETUP_STEPS } from '@/lib/onboarding/supplierSetup';

const mocks = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));

vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Next Image is mocked for DOM tests.
    <img {...props} />
  ),
}));

const draft = {
  name: 'Okechukwu Fashion',
  phone: '08031234567',
  email: 'hello@example.com',
  description: 'Fashion retailer',
  completedAt: '2026-10-26T00:00:00.000Z',
};

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clearOnboardingBusiness();
});

describe('Supplier Setup screen', () => {
  it('renders the heading, the six-step checklist and the navigation actions', () => {
    render(<SupplierSetupScreen />);
    expect(screen.getByRole('heading', { name: 'Set up your supplier business' })).toBeTruthy();
    expect(screen.getByText('Your supplier setup')).toBeTruthy();
    SUPPLIER_SETUP_STEPS.forEach((step) => expect(screen.getByText(step.label)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Complete setup' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/dashboard/overview');
    expect(screen.getByRole('link', { name: 'skip' }).getAttribute('href')).toBe('/dashboard/overview');
  });

  it('continues to the first incomplete step (Business information) when nothing is done', async () => {
    const user = userEvent.setup();
    render(<SupplierSetupScreen />);
    expect(screen.getAllByText('not completed')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'Complete setup' }));
    expect(mocks.router.push).toHaveBeenCalledWith('/auth/create-business');
  });

  it('reflects the Create Business draft and continues to the next incomplete step', async () => {
    writeOnboardingBusiness(draft);
    const user = userEvent.setup();
    render(<SupplierSetupScreen />);
    expect(screen.getAllByText('completed')).toHaveLength(1);
    expect(screen.getAllByText('not completed')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Complete setup' }));
    expect(mocks.router.push).toHaveBeenCalledWith('/dashboard/business-profile');
  });

  it('shows a success state and a dashboard button when every step is complete', async () => {
    writeOnboardingBusiness(draft);
    const user = userEvent.setup();
    render(
      <SupplierSetupScreen completedStepIds={SUPPLIER_SETUP_STEPS.map((step) => step.id)} />,
    );
    expect(screen.getAllByText('completed')).toHaveLength(6);
    expect(screen.getByRole('status')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Go to dashboard' });
    await user.click(button);
    expect(mocks.router.push).toHaveBeenCalledWith('/dashboard/overview');
  });
});
