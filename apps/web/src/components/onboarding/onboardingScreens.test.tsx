/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountWelcomePage from '@/app/auth/welcome/page';
import { AccountCreatedSuccess } from './AccountCreatedSuccess';
import RoleSelectionPage from '@/app/auth/role-selection/page';
import { VerifyEmailConfirm } from '@/components/auth/VerifyEmailConfirm';
import { ROLE_OPTIONS, ROLE_RECOMMENDATIONS } from '@/lib/onboarding/roles';
import { clearOnboardingRole, ONBOARDING_ROLE_STORAGE_KEY } from '@/lib/auth/flowState';
import {
  getPendingVerificationEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/pendingVerification';

const VERIFIED = '2026-10-26T00:00:00.000Z';

type SessionUser = {
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  onboardingIntent: string | null;
};

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  getMe: vi.fn(),
  sessionStatus: 'authenticated',
  sessionUser: null as SessionUser | null,
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
    user: mocks.sessionStatus === 'authenticated' ? mocks.sessionUser : null,
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
  roleApi: { saveRole: mocks.saveRole },
  roleForBusinessType: (intent: string) =>
    intent === 'ENTERPRISE' ? 'supplier' : intent === 'RETAILER' ? 'retailer' : 'entrepreneur',
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearOnboardingRole();
  mocks.sessionStatus = 'authenticated';
  mocks.sessionUser = {
    firstName: 'Person',
    lastName: 'Example',
    emailVerifiedAt: VERIFIED,
    onboardingIntent: null,
  };
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

async function chooseRoleAndReview(optionIndex: number) {
  const user = userEvent.setup();
  render(<RoleSelectionPage />);
  await user.click(await findRadio(ROLE_OPTIONS[optionIndex]!.label));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
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
    expect(mocks.saveRole).not.toHaveBeenCalled();
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

  it('shows the recommendation for the picked role without saving or navigating', async () => {
    await chooseRoleAndReview(1);

    expect(await screen.findByRole('heading', { name: 'Your Recommended Role' })).toBeTruthy();
    const copy = ROLE_RECOMMENDATIONS.retailer;
    expect(screen.getByText(copy.subtitle)).toBeTruthy();
    expect(screen.getByText(copy.heading)).toBeTruthy();
    copy.bullets.forEach((bullet) => expect(screen.getByText(bullet.text)).toBeTruthy());
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue as a Retailer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeTruthy();

    expect(mocks.saveRole).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    // The selection is still the user's choice, remembered locally.
    expect(sessionStorage.getItem(ONBOARDING_ROLE_STORAGE_KEY)).toBe('retailer');
  });

  it('focuses the recommendation heading when the view switches', async () => {
    await chooseRoleAndReview(1);
    const heading = await screen.findByRole('heading', { name: 'Your Recommended Role' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('saves the role on Continue, refreshes the session with the API user, then replaces to the dashboard', async () => {
    const savedUser = {
      id: 'user-1',
      email: 'person@example.com',
      firstName: 'Person',
      lastName: 'Example',
      emailVerifiedAt: VERIFIED,
      onboardingIntent: 'RETAILER',
    };
    mocks.saveRole.mockResolvedValue({ user: savedUser, businessType: 'RETAILER' });
    const user = await chooseRoleAndReview(1);

    await user.click(screen.getByRole('button', { name: 'Continue as a Retailer' }));

    await waitFor(() => expect(mocks.saveRole).toHaveBeenCalledWith('retailer'));
    expect(mocks.acceptAuthenticatedUser).toHaveBeenCalledWith(savedUser);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it('keeps the recommendation and re-enables Continue when saving fails', async () => {
    mocks.saveRole.mockRejectedValue(new Error('offline'));
    const user = await chooseRoleAndReview(1);

    await user.click(screen.getByRole('button', { name: 'Continue as a Retailer' }));

    expect(
      await screen.findByText("We couldn't save your selection. Please try again."),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your Recommended Role' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue as a Retailer' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('Go Back returns to the choices with the previous selection kept', async () => {
    const user = await chooseRoleAndReview(1);
    await user.click(screen.getByRole('button', { name: 'Go Back' }));

    expect(await screen.findByRole('heading', { name: 'How will you use Sellonit?' })).toBeTruthy();
    expect(getRadio(ROLE_OPTIONS[1].label).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);
    expect(mocks.saveRole).not.toHaveBeenCalled();
  });

  it('redirects an onboarded user away from role selection exactly once', async () => {
    mocks.sessionUser = {
      firstName: 'Person',
      lastName: 'Example',
      emailVerifiedAt: VERIFIED,
      onboardingIntent: 'ENTERPRISE',
    };
    render(<RoleSelectionPage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard/overview'));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'How will you use Sellonit?' })).toBeNull();
  });

  it('redirects an unverified user to the verify-email step', async () => {
    mocks.sessionUser = {
      firstName: 'Person',
      lastName: 'Example',
      emailVerifiedAt: null,
      onboardingIntent: null,
    };
    render(<RoleSelectionPage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/verify-email'));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it('redirects unauthenticated visitors to Login', async () => {
    mocks.sessionStatus = 'unauthenticated';
    render(<RoleSelectionPage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
  });
});

describe('verification success redirect', () => {
  it('uses replace to continue onboarding and clears the pending email', async () => {
    setPendingVerificationEmail('person@example.com');
    mocks.verifyEmail.mockResolvedValue({
      user: { email: 'person@example.com', phone: null, emailVerifiedAt: VERIFIED },
    });
    render(<VerifyEmailConfirm />);

    await waitFor(() => expect(mocks.verifyEmail).toHaveBeenCalledWith('email-token'));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(getPendingVerificationEmail()).toBeNull();
  });

  it('treats a freshly verified account as verified even if the payload is stale', async () => {
    setPendingVerificationEmail('person@example.com');
    mocks.verifyEmail.mockResolvedValue({ user: { email: 'person@example.com', phone: null } });
    render(<VerifyEmailConfirm />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    // Never bounces back to the page it just came from.
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/verify-email');
  });

  it('sends an already-verified callback into the app rather than back to verify email', async () => {
    setPendingVerificationEmail('person@example.com');
    mocks.getMe.mockResolvedValue({
      data: {
        email: 'person@example.com',
        emailVerifiedAt: '2026-10-21T00:00:00.000Z',
        onboardingIntent: null,
      },
    });
    render(<VerifyEmailConfirm />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/role-selection'));
    expect(mocks.verifyEmail).not.toHaveBeenCalled();
    expect(getPendingVerificationEmail()).toBeNull();
  });
});
