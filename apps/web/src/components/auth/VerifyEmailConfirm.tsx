'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { BagMark } from '@/components/brand/BagMark';
import { getMe, verifyEmail } from '@/lib/auth/api';
import { emailLinkErrorMessage, isRetryableAuthError } from '@/lib/auth/errors';
import { PENDING_VERIFICATION_EMAIL_KEY } from '@/lib/auth/pendingVerification';

type ConfirmStatus =
  | { kind: 'verifying' }
  | { kind: 'verified' }
  | { kind: 'error'; message: string; retryable: boolean };

const cardClass =
  'flex w-full max-w-[632px] flex-col items-center gap-6 rounded-3xl border border-[#E5E7EB] bg-white px-5 py-8 text-center shadow-[0_4px_16px_rgba(0,0,0,0.08)] sm:px-8 sm:py-10 lg:rounded-[36px] lg:px-[36px] lg:py-12';
const headingClass =
  'text-[19px] leading-8 font-bold text-ink sm:text-[26px] sm:leading-[34px] lg:text-[30px] lg:leading-9';
const bodyClass =
  'text-base leading-6 font-normal text-[#6B7280] sm:text-lg sm:leading-7 lg:text-[20px] lg:leading-[30px]';

function StatusHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-4 md:gap-6">
      <BagMark />
      <h1 className={headingClass}>{children}</h1>
    </div>
  );
}

/** sessionStorage does not change behind our back; an empty subscription is enough. */
const emptySubscribe = () => () => {};

/**
 * Reads the token from the query string and calls POST /auth/verify-email
 * once, on mount. The ref stops React StrictMode from running the effect
 * twice, which would spend a single-use token twice. On success the contract
 * API has established the session, so the app routes to the standalone account-success screen.
 */
export function VerifyEmailConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // Client-only storage, read without effects (server snapshot is always null).
  const pendingEmail = useSyncExternalStore(
    emptySubscribe,
    () => window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY),
    () => null,
  );
  const [status, setStatus] = useState<ConfirmStatus>(() =>
    token
      ? { kind: 'verifying' }
      : {
          kind: 'error',
          message: 'This verification link is incomplete. Open the link from your email.',
          retryable: false,
        },
  );
  const startedRef = useRef(false);

  const runVerification = useCallback(
    (value: string) => {
      setStatus({ kind: 'verifying' });
      void (async () => {
        try {
          // Detect an existing session for a different account before allowing the verification response to replace it.
          if (pendingEmail) {
            try {
              const existing = await getMe();
              if (existing.data.email.toLowerCase() !== pendingEmail.toLowerCase()) {
                setStatus({
                  kind: 'error',
                  message:
                    'You are already logged in as a different account. Log out of that account, then reopen this verification link.',
                  retryable: false,
                });
                return;
              }
              if (existing.data.emailVerifiedAt) {
                setStatus({ kind: 'verified' });
                router.replace(existing.data.phone ? '/' : '/account');
                return;
              }
            } catch {
              // A 401 means signed out; other failures are handled by the actual verification request.
            }
          }
          await verifyEmail(value);
          setStatus({ kind: 'verified' });
          // The verification endpoint establishes the HttpOnly session before this standalone success route loads.
          router.replace('/auth/welcome');
        } catch (error: unknown) {
          setStatus({
            kind: 'error',
            message: emailLinkErrorMessage(error),
            retryable: isRetryableAuthError(error),
          });
        }
      })();
    },
    [pendingEmail, router],
  );

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }
    startedRef.current = true;
    runVerification(token);
  }, [token, runVerification]);

  if (status.kind === 'verifying') {
    return (
      <div className={cardClass}>
        <StatusHeading>Verifying your email</StatusHeading>
        <p className={bodyClass}>This will only take a moment.</p>
      </div>
    );
  }

  if (status.kind === 'verified') {
    return (
      <div className={cardClass}>
        <StatusHeading>Email verified</StatusHeading>
        <p className={bodyClass}>Your email address is verified. Taking you to your account.</p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <StatusHeading>We could not verify your email</StatusHeading>
      <p className={bodyClass} aria-live="polite">
        {status.message}
      </p>
      <div className="flex w-full flex-col items-center gap-4">
        {status.retryable && token ? (
          <button
            type="button"
            onClick={() => runVerification(token)}
            className="flex h-14 w-full items-center justify-center rounded-full bg-[#FF8B00] px-6 text-xl leading-7 font-semibold text-ink transition-colors hover:bg-[#E67D00] active:bg-[#CC6F00] sm:h-16 sm:text-2xl sm:leading-8 lg:h-[68px] lg:text-[25px] lg:leading-9"
          >
            Try again
          </button>
        ) : null}
        {/* Expired/invalid token: request a new link when the email is known. */}
        {pendingEmail && !status.retryable ? (
          <Link
            href="/auth/verify-email"
            className="text-base font-semibold text-ink underline underline-offset-2 lg:text-lg"
          >
            Request a new link
          </Link>
        ) : null}
        <Link
          href="/auth/register"
          className="text-base font-semibold text-ink underline underline-offset-2 lg:text-lg"
        >
          Use a different email
        </Link>
        <Link
          href="/auth/login"
          className="text-base font-semibold text-ink underline underline-offset-2 lg:text-lg"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
