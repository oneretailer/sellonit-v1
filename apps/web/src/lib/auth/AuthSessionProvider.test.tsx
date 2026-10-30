/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import {
  AuthSessionProvider,
  useAuthSession,
  type InitialAuthSession,
} from './AuthSessionProvider';
import { RequireAuthenticatedSession } from '@/components/auth/RequireAuthenticatedSession';
import { clearOnboardingRole } from './flowState';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('./api', () => ({ getMe: mocks.getMe }));

const validUser = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: null,
  status: 'ACTIVE',
  emailVerifiedAt: '2026-10-26T00:00:00.000Z',
  phoneVerifiedAt: null,
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
} as const;

function Consumer() {
  const { status, user } = useAuthSession();
  return <p>{status === 'authenticated' ? user?.firstName : status}</p>;
}

function TestApp({
  initialSession,
  children,
}: {
  initialSession: InitialAuthSession;
  children: ReactNode;
}) {
  return <AuthSessionProvider initialSession={initialSession}>{children}</AuthSessionProvider>;
}

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  clearOnboardingRole();
  mocks.getMe.mockResolvedValue({ data: validUser });
});

describe('shared auth session', () => {
  it('renders guarded content from the server-confirmed session without a visible session-check message', async () => {
    const initialSession: InitialAuthSession = { status: 'authenticated', user: validUser };
    render(
      <TestApp initialSession={initialSession}>
        <RequireAuthenticatedSession>
          <p>Protected onboarding content</p>
        </RequireAuthenticatedSession>
      </TestApp>,
    );
    expect(await screen.findByText('Protected onboarding content')).toBeTruthy();
    expect(document.body.textContent).not.toContain(['Checking your', 'session'].join(' '));
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('does not reveal guarded content for an invalid or expired server session', async () => {
    const initialSession: InitialAuthSession = { status: 'unauthenticated', user: null };
    render(
      <TestApp initialSession={initialSession}>
        <RequireAuthenticatedSession>
          <p>Protected onboarding content</p>
        </RequireAuthenticatedSession>
      </TestApp>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
    expect(screen.queryByText('Protected onboarding content')).toBeNull();
  });

  it('keeps a tab-only display hint, then removes it when the authoritative check returns 401', async () => {
    const hintKey = 'sellonit.auth.session-hint';
    sessionStorage.setItem(
      hintKey,
      JSON.stringify({ authenticated: true, displayName: 'Ada Lovelace' }),
    );
    mocks.getMe.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Expired'));
    const initialSession: InitialAuthSession = { status: 'checking', user: null };
    function Guarded() {
      const { status } = useAuthSession();
      return <p>{status}</p>;
    }
    render(
      <TestApp initialSession={initialSession}>
        <Guarded />
      </TestApp>,
    );
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    expect(sessionStorage.getItem(hintKey)).toBeNull();
  });

  it('never allows a stale tab hint to expose protected content after the cookie check expires', async () => {
    sessionStorage.setItem(
      'sellonit.auth.session-hint',
      JSON.stringify({ authenticated: true, displayName: 'Ada Lovelace' }),
    );
    mocks.getMe.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Expired'));
    const initialSession: InitialAuthSession = { status: 'checking', user: null };
    render(
      <TestApp initialSession={initialSession}>
        <RequireAuthenticatedSession>
          <p>Protected onboarding content</p>
        </RequireAuthenticatedSession>
      </TestApp>,
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/auth/login'));
    expect(screen.queryByText('Protected onboarding content')).toBeNull();
    expect(sessionStorage.getItem('sellonit.auth.session-hint')).toBeNull();
  });

  it('stores only a boolean and a non-sensitive display name after a successful check', async () => {
    const initialSession: InitialAuthSession = { status: 'checking', user: null };
    render(
      <TestApp initialSession={initialSession}>
        <Consumer />
      </TestApp>,
    );
    expect(await screen.findByText('Ada')).toBeTruthy();
    await waitFor(() =>
      expect(sessionStorage.getItem('sellonit.auth.session-hint')).not.toBeNull(),
    );
    const cached = JSON.parse(
      sessionStorage.getItem('sellonit.auth.session-hint') ?? '{}',
    ) as Record<string, unknown>;
    expect(cached).toEqual({ authenticated: true, displayName: 'Ada Lovelace' });
    expect(JSON.stringify(cached)).not.toContain('token');
    expect(JSON.stringify(cached)).not.toContain('password');
  });

  it('allows retry after a transient provider error', async () => {
    mocks.getMe
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: validUser });
    const initialSession: InitialAuthSession = { status: 'checking', user: null };
    function RetryConsumer() {
      const { status, refreshSession } = useAuthSession();
      return (
        <button onClick={() => void refreshSession()}>
          {status === 'error' ? 'Try again' : status}
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <TestApp initialSession={initialSession}>
        <RetryConsumer />
      </TestApp>,
    );
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'authenticated' })).toBeTruthy());
  });
});
