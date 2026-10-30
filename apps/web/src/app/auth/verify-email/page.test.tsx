/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyEmailPage from './page';
import {
  PENDING_VERIFICATION_EMAIL_KEY,
  setPendingVerificationEmail,
} from '@/lib/auth/pendingVerification';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  resendVerification: vi.fn(),
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
vi.mock('@/lib/auth/api', () => ({ resendVerification: mocks.resendVerification }));

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.resendVerification.mockRejectedValue(new Error('No resend endpoint is configured'));
});

describe('check-your-email recovery', () => {
  it('restores the pending email after a refresh-like remount and does not redirect', async () => {
    setPendingVerificationEmail('jane@example.com');
    render(<VerifyEmailPage />);

    expect(await screen.findByText(/We sent a verification link to jane@example.com/)).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/register');
    expect(screen.getByRole('button', { name: 'Resend verification link' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/auth/login?email=jane%40example.com',
    );
  });

  it.each(['missing', 'expired'])(
    '%s pending email shows email recovery instead of redirecting',
    async (caseName) => {
      if (caseName === 'expired') {
        localStorage.setItem(
          PENDING_VERIFICATION_EMAIL_KEY,
          JSON.stringify({ email: 'jane@example.com', expiresAt: Date.now() - 1 }),
        );
      }
      render(<VerifyEmailPage />);

      expect(await screen.findByRole('textbox', { name: 'Email address' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Resend verification link' }).hasAttribute('disabled'),
      ).toBe(true);
      expect(mocks.router.replace).not.toHaveBeenCalled();
    },
  );

  it('offers a prefilled login after the user verifies in another browser', async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPage />);
    await user.type(
      await screen.findByRole('textbox', { name: 'Email address' }),
      'Jane@Example.com',
    );
    await user.click(screen.getByRole('button', { name: "I've verified my email" }));

    expect(mocks.router.push).toHaveBeenCalledWith('/auth/login?email=jane%40example.com');
  });

  it('offers resend on the recovery form and explains that resending is unavailable', async () => {
    const user = userEvent.setup();
    render(<VerifyEmailPage />);
    await user.type(
      await screen.findByRole('textbox', { name: 'Email address' }),
      'jane@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Resend verification link' }));

    await waitFor(() =>
      expect(mocks.resendVerification).toHaveBeenCalledWith({ email: 'jane@example.com' }),
    );
    expect(await screen.findByText(/We can't resend the verification link yet/)).toBeTruthy();
    expect(localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();
  });
});
