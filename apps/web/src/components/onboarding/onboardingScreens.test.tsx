/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountWelcomePage from '@/app/auth/welcome/page';
import { AccountCreatedSuccess } from './AccountCreatedSuccess';
import RoleSelectionPage from '@/app/auth/role-selection/page';
import { VerifyEmailConfirm } from '@/components/auth/VerifyEmailConfirm';
import { ROLE_OPTIONS } from '@/lib/onboarding/roles';
import { clearOnboardingRole, ONBOARDING_ROLE_STORAGE_KEY } from '@/lib/auth/flowState';
import {
  getPendingVerificationEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/pendingVerification';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  getMe: vi.fn(),
  sessionStatus: 'authenticated',
  acceptAuthenticatedUser: vi.fn(),
  refreshSession: vi.fn(),
  verifyEmail: vi.fn(),
  saveRole: vi.fn(),
  token: 'email-token',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => '/auth/role-selection',
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? mocks.token : null) }),
}));

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
  useAuthSession: () => ({
    status: mocks.sessionStatus,
    user:
      mocks.sessionStatus === 'authenticated' ? { firstName: 'Person', lastName: 'Example' } : null,
    cachedDisplayName: 'Person Example',
    acceptAuthenticatedUser: mocks.acceptAuthenticatedUser,
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock('@/lib/auth/api', () => ({
  getMe: mocks.getMe,
  verifyEmail: mocks.verifyEmail,
  resendVerification: vi.fn(),
}));

vi.mock('@/lib/onboarding/roleApi', () => ({
  roleApi: {
    saveRole: mocks.saveRole,
    getRecommendation: (role: string) => ({
      role,
      track: role,
      nextRoute: role === 'supplier' ? '/dashboard/overview' : '/dashboard/coming-soon',
    }),
  },
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingRole();
  mocks.sessionStatus = 'authenticated';
  mocks.token = 'email-token';
  mocks.refreshSession.mockResolvedValue({ email: 'person@example.com' });
  mocks.getMe.mockResolvedValue({ data: { email: 'person@example.com' } });
});

function getRadio(label: string): HTMLInputElement {
  const radio = screen.getByRole('radio', { name: label });
  if (!(radio instanceof HTMLInputElement)) throw new Error('Expected a native radio input');
  return radio;
}

async function findRadio(label: string): Promise<HTMLInputElement> {
  const radio = await screen.findByRole('radio', { name: label });
  if (!(radio instanceof HTMLInputElement)) throw new Error('Expected a native radio input');
  return radio;
}

describe('account-created success screen', () => {
  it('renders one decorative bag before its heading, success icon, copy, and role CTA; focuses the heading', async () => {
    render(<AccountCreatedSuccess />);

    const heading = await screen.findByRole('heading', { name: 'Account successfully created' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const bag = document.querySelector('img[src="/shopping-bag.svg"]');
    expect(bag).not.toBeNull();
    expect(bag?.getAttribute('aria-hidden')).toBe('true');
    expect(bag?.getAttribute('alt')).toBe('');
    expect(
      (bag?.compareDocumentPosition(heading) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(
      screen.getByText('Click on the button below to set up your business account'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Set up your Business account' }).getAttribute('href'),
    ).toBe('/auth/role-selection');
  });

  it('redirects unauthenticated visitors to Login', async () => {
    mocks.sessionStatus = 'unauthenticated';
    render(<AccountWelcomePage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
  });
});

describe('role selection screen', () => {
  it('renders the three native choices unselected and has no BagMark', async () => {
    const { container } = render(<RoleSelectionPage />);
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    ROLE_OPTIONS.forEach((option) => {
      const radio = getRadio(option.label);
      expect(radio.type).toBe('radio');
      expect(radio.name).toBe('account-role');
      expect(radio.checked).toBe(false);
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    expect(container.querySelector('img[src="/shopping-bag.svg"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/auth/welcome');
  });

  it('selection enables Continue, and native arrow-key navigation moves between radios', async () => {
    const user = userEvent.setup();
    render(<RoleSelectionPage />);
    const first = await findRadio(ROLE_OPTIONS[0].label);
    const second = getRadio(ROLE_OPTIONS[1].label);

    await user.click(first);
    expect(first.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);

    first.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(second.checked).toBe(true));
  });

  it('saves the selected role and follows the returned recommendation route', async () => {
    const user = userEvent.setup();
    mocks.saveRole.mockResolvedValue({
      role: 'supplier',
      track: 'supplier',
      nextRoute: '/dashboard/overview',
    });
    render(<RoleSelectionPage />);

    await user.click(await screen.findByRole('radio', { name: ROLE_OPTIONS[2].label }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mocks.saveRole).toHaveBeenCalledWith('supplier'));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/dashboard/overview'));
    expect(sessionStorage.getItem(ONBOARDING_ROLE_STORAGE_KEY)).toBe('supplier');
  });

  it('keeps the selection and re-enables Continue after save fails', async () => {
    const user = userEvent.setup();
    mocks.saveRole.mockRejectedValue(new Error('offline'));
    render(<RoleSelectionPage />);

    const radio = await findRadio(ROLE_OPTIONS[0].label);
    await user.click(radio);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText("We couldn't save your selection. Please try again."),
    ).toBeTruthy();
    expect(radio.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);
  });

  it('uses the saved role after a refresh-like remount without looping on role selection', async () => {
    const { unmount } = render(<RoleSelectionPage />);
    const radio = await screen.findByRole('radio', { name: ROLE_OPTIONS[1].label });
    fireEvent.click(radio);
    expect(sessionStorage.getItem(ONBOARDING_ROLE_STORAGE_KEY)).toBe('retailer');

    unmount();
    render(<RoleSelectionPage />);
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/coming-soon'),
    );
    expect(sessionStorage.getItem(ONBOARDING_ROLE_STORAGE_KEY)).toBe('retailer');
  });

  it('redirects unauthenticated visitors to Login', async () => {
    mocks.sessionStatus = 'unauthenticated';
    render(<RoleSelectionPage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
  });
});

describe('verification success redirect', () => {
  it('uses replace to reach success and clears pending email after session-establishing verification', async () => {
    setPendingVerificationEmail('person@example.com');
    mocks.verifyEmail.mockResolvedValue({ user: { email: 'person@example.com', phone: null } });
    render(<VerifyEmailConfirm />);

    await waitFor(() => expect(mocks.verifyEmail).toHaveBeenCalledWith('email-token'));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(getPendingVerificationEmail()).toBeNull();
  });

  it('sends an already-verified callback through the onboarding gate rather than /account by default', async () => {
    setPendingVerificationEmail('person@example.com');
    mocks.getMe.mockResolvedValue({
      data: { email: 'person@example.com', emailVerifiedAt: '2026-10-21T00:00:00.000Z' },
    });
    render(<VerifyEmailConfirm />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(mocks.verifyEmail).not.toHaveBeenCalled();
    expect(getPendingVerificationEmail()).toBeNull();
  });
});
