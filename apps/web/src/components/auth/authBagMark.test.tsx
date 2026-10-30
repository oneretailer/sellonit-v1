import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomePage from '@/app/page';
import VerifyEmailPage from '@/app/auth/verify-email/page';
import AccountDetailsPage from '@/app/auth/register/account-details/page';
import SignupEntryPage from '@/app/auth/register/page';
import { VerifyEmailConfirm } from '@/components/auth/VerifyEmailConfirm';
import { LoginForm } from '@/components/login/LoginForm';
import { CodeForm } from '@/components/password-reset/CodeForm';
import { NewPasswordForm } from '@/components/password-reset/NewPasswordForm';
import { RequestCodeForm } from '@/components/password-reset/RequestCodeForm';
import { ResetSuccess } from '@/components/password-reset/ResetSuccess';

const controls = vi.hoisted(() => ({
  externalStoreValue: 'person@example.com',
  verificationStatus: null as
    | { kind: 'verifying' }
    | { kind: 'verified' }
    | { kind: 'error'; message: string; retryable: boolean }
    | null,
  token: 'verification-token',
  authFlow: {
    step: 'verify' as const,
    identifier: 'person@example.com',
    identifierType: 'email' as const,
    purpose: 'reset-password',
    resendAvailableAt: null,
  },
  resetFlow: {
    verifiedCode: '123456',
    setVerifiedCode: vi.fn(),
    completed: true,
    markCompleted: vi.fn(),
  },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useSyncExternalStore: (
      subscribe: Parameters<typeof actual.useSyncExternalStore>[0],
      getSnapshot: Parameters<typeof actual.useSyncExternalStore>[1],
      getServerSnapshot?: Parameters<typeof actual.useSyncExternalStore>[2],
    ) => {
      if (controls.externalStoreValue !== undefined) return controls.externalStoreValue;
      return actual.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    },
    useState: <S,>(initial: S | (() => S)) => {
      const state = actual.useState(initial);
      const value = typeof initial === 'function' ? (initial as () => S)() : initial;
      if (controls.verificationStatus && value && typeof value === 'object' && 'kind' in value) {
        return [controls.verificationStatus as S, state[1]] as [S, (typeof state)[1]];
      }
      return state;
    },
  };
});

vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    status: 'unauthenticated',
    user: null,
    cachedDisplayName: null,
    acceptAuthenticatedUser: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

vi.mock('@/lib/auth/api', () => ({
  getMe: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => controls.router,
  usePathname: () => '/',
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? controls.token : null) }),
}));

vi.mock('@/components/password-reset/useStoredAuthFlow', () => ({
  useStoredAuthFlow: () => [controls.authFlow, vi.fn()],
}));

vi.mock('@/components/password-reset/FlowProvider', () => ({
  useForgotPasswordFlow: () => controls.resetFlow,
}));

function assertOneDecorativeBagBeforeHeading(element: ReactElement) {
  const markup = renderToStaticMarkup(element);
  const bags = [...markup.matchAll(/src="\/shopping-bag\.svg"/g)];
  expect(bags).toHaveLength(1);
  const bagIndex = bags[0]?.index ?? -1;
  const imageStart = markup.lastIndexOf('<img', bagIndex);
  const imageEnd = markup.indexOf('>', bagIndex);
  const imageTag = markup.slice(imageStart, imageEnd + 1);
  expect(imageTag).toContain('alt=""');
  expect(imageTag).toContain('aria-hidden="true"');
  expect(imageStart).toBeLessThan(markup.indexOf('<h1'));
}

describe('auth screen BagMark rendering', () => {
  beforeEach(() => {
    controls.externalStoreValue = 'person@example.com';
    controls.verificationStatus = null;
    controls.token = 'verification-token';
    controls.authFlow = {
      step: 'verify',
      identifier: 'person@example.com',
      identifierType: 'email',
      purpose: 'reset-password',
      resendAvailableAt: null,
    };
    controls.resetFlow = {
      verifiedCode: '123456',
      setVerifiedCode: vi.fn(),
      completed: true,
      markCompleted: vi.fn(),
    };
  });

  it.each([
    ['landing', () => <WelcomePage />],
    ['sign-up chooser', () => <SignupEntryPage />],
    ['account details', () => <AccountDetailsPage />],
    ['login', () => <LoginForm />],
    ['check email', () => <VerifyEmailPage />],
    ['forgot password request', () => <RequestCodeForm />],
    ['password reset code entry', () => <CodeForm purpose="reset-password" />],
    [
      'account verification code entry',
      () => {
        controls.authFlow = { ...controls.authFlow, purpose: 'verify-account' };
        return <CodeForm purpose="verify-account" />;
      },
    ],
    ['new password', () => <NewPasswordForm />],
    ['password-reset success', () => <ResetSuccess />],
  ])('renders one decorative bag before the heading on %s', (_name, createScreen) => {
    assertOneDecorativeBagBeforeHeading(createScreen());
  });

  it.each([
    ['verifying', { kind: 'verifying' }, 'verification-token'],
    ['verified success', { kind: 'verified' }, 'verification-token'],
    [
      'incomplete link',
      { kind: 'error', message: 'Incomplete link', retryable: false },
      'verification-token',
    ],
    [
      'invalid or expired link',
      { kind: 'error', message: 'Invalid link', retryable: false },
      'verification-token',
    ],
    [
      'different account',
      { kind: 'error', message: 'Different account', retryable: false },
      'verification-token',
    ],
    [
      'retryable/network error',
      { kind: 'error', message: 'Try again', retryable: true },
      'verification-token',
    ],
  ] as const)(
    'renders one decorative bag before the heading for verification %s',
    (_name, status, token) => {
      controls.verificationStatus = status;
      controls.token = token;
      assertOneDecorativeBagBeforeHeading(<VerifyEmailConfirm />);
    },
  );
});
