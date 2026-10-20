'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { resendVerification } from '@/lib/auth/api';
import { PENDING_VERIFICATION_EMAIL_KEY } from '@/lib/auth/pendingVerification';

/** TODO: replace with Figma design. Minimal functional placeholder only. */

/** Resend cooldown in seconds (addition — Figma has no design for this page). */
const RESEND_COOLDOWN_SECONDS = 30;

/** sessionStorage does not change behind our back; an empty subscription is enough. */
const emptySubscribe = () => () => {};

export default function VerifyEmailPage() {
  const router = useRouter();
  // Client-only storage, read without effects (server snapshot is always null).
  const email = useSyncExternalStore(
    emptySubscribe,
    () => window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY),
    () => null,
  );
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const startedRef = useRef(false);

  // Guard: without a pending email there is nothing to verify — go back.
  useEffect(() => {
    if (!email) {
      router.replace('/auth/register');
    }
  }, [email, router]);

  // Cooldown countdown.
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const timer = setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleResend() {
    if (!email || cooldown > 0 || resendState === 'sending') {
      return;
    }
    setResendState('sending');
    try {
      await resendVerification({ email });
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResendState('failed');
    }
  }

  if (!email) {
    return null;
  }

  return (
   <div className='pt-15 w-full flex items-center justify-center'>
     <div className="flex w-full max-w-[632px] flex-col items-center gap-6 rounded-3xl border border-[#E5E7EB] bg-white px-5 py-8 text-center shadow-[0_4px_16px_rgba(0,0,0,0.08)] sm:px-8 sm:py-10 lg:rounded-[36px] lg:px-[36px] lg:py-12">
      <h1 className="text-[19px] leading-8 font-bold text-ink sm:text-[26px] sm:leading-[34px] lg:text-[30px] lg:leading-9">
        Check your email
      </h1>
      <p className="text-base leading-6 font-normal text-[#6B7280] sm:text-lg sm:leading-7 lg:text-[20px] lg:leading-[30px]">
        We sent a link to {email}
      </p>

      <div className="flex w-full flex-col items-center gap-4" aria-live="polite">
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={cooldown > 0 || resendState === 'sending'}
          aria-disabled={cooldown > 0 || resendState === 'sending'}
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#FF8B00] px-6 text-xl leading-7 font-semibold text-ink transition-colors hover:bg-[#E67D00] active:bg-[#CC6F00] disabled:cursor-not-allowed disabled:bg-primary-disabled sm:h-16 sm:text-2xl sm:leading-8 lg:h-[68px] lg:text-[25px] lg:leading-9"
        >
          {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
        </button>
        {resendState === 'sent' ? (
          <p className="text-sm text-success lg:text-base">Link sent.</p>
        ) : null}
        {resendState === 'failed' ? (
          <p className="text-sm text-danger lg:text-base">
            We couldn&apos;t send the link. Try again.
          </p>
        ) : null}
      </div>

      <Link
        href="/auth/register"
        className="text-base font-semibold text-ink underline underline-offset-2 lg:text-lg"
      >
        Use a different email
      </Link>
    </div>
   </div>
  );
}
