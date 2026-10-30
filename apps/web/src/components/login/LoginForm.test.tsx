/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { clearOnboardingRole, writeOnboardingRole } from '@/lib/auth/flowState';
import {
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/pendingVerification';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  loginWithIdentifier: vi.fn(),
  acceptAuthenticatedUser: vi.fn(),
}));

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
    // eslint-disable-next-line @next/next/no-img-element -- Next Image is mocked as a plain image in DOM tests.
    <img {...props} />
  ),
}));
vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({ acceptAuthenticatedUser: mocks.acceptAuthenticatedUser }),
}));
vi.mock('@/lib/auth/authService', () => ({
  AUTH_MESSAGES: { accountNotVerified: 'Your account is not verified.' },
  authMessageFor: vi.fn(),
  loginWithIdentifier: mocks.loginWithIdentifier,
  mapLoginError: vi.fn(),
  mapResendCodeError: vi.fn(),
  resendCode: vi.fn(),
}));

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearPendingVerificationEmail();
  clearOnboardingRole();
  vi.clearAllMocks();
  mocks.loginWithIdentifier.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      status: 'ACTIVE',
      emailVerifiedAt: '2026-10-26T00:00:00.000Z',
      phoneVerifiedAt: null,
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
    },
    expiresIn: 3600,
  });
});

async function completeLogin() {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(
    screen.getByRole('textbox', { name: 'Email or phone number' }),
    'jane@example.com',
  );
  await user.type(screen.getByLabelText('Password'), 'ExamplePassword123');
  await user.click(screen.getByRole('button', { name: 'Log In' }));
  await waitFor(() => expect(mocks.loginWithIdentifier).toHaveBeenCalled());
}

describe('post-login onboarding destination', () => {
  it('routes a user with no locally stored role to role selection', async () => {
    await completeLogin();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
  });

  it('routes a user with a saved role to that role recommendation', async () => {
    writeOnboardingRole('supplier');
    await completeLogin();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.acceptAuthenticatedUser).toHaveBeenCalled();
  });

  it('clears pending verification email after a successful login', async () => {
    setPendingVerificationEmail('jane@example.com');
    await completeLogin();
    expect(getPendingVerificationEmail()).toBeNull();
  });
});
