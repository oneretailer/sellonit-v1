'use client';

import { useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PhoneField } from '@/components/reuseable/PhoneField';
import { PrimaryButton, PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { TextField } from '@/components/reuseable/TextField';
import { sendPhoneVerification, updatePhone, verifyPhone } from '@/lib/auth/api';
import { authErrorMessage } from '@/lib/auth/errors';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import {
  formatPhoneDisplay,
  isNigerianPhoneDigits,
  normalizePhoneInput,
  toLocalPhone,
} from '@/lib/auth/validation';

/** Minimal account details view backed by the shared cookie-session provider. */
export function AccountPanel() {
  const { status, user, refreshSession, acceptAuthenticatedUser } = useAuthSession();
  const [phoneDraft, setPhoneDraft] = useState<{ userId: string; digits: string } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  /** Set once POST /auth/send-phone-verification succeeds, so the code field appears. */
  const [codeSent, setCodeSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const phoneDigits = user
    ? phoneDraft?.userId === user.id
      ? phoneDraft.digits
      : user.phone
        ? normalizePhoneInput(user.phone)
        : ''
    : '';

  if (status === 'checking') {
    return (
      <div aria-busy="true" className="flex flex-col items-center gap-4 py-6">
        <span
          role="status"
          aria-label="Loading account"
          className="block h-7 w-40 animate-pulse rounded-full bg-gray-200"
        />
        <span className="block h-4 w-56 max-w-full animate-pulse rounded-full bg-gray-100" />
        <span className="block h-12 w-full animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-ink">You&apos;re not signed in</h1>
          <p className="text-sm text-subtle">Log in to see your Sellonit account.</p>
        </div>
        <PrimaryLinkButton href="/auth/login">Log in</PrimaryLinkButton>
      </div>
    );
  }

  if (status === 'error' || !user) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-ink">We couldn&apos;t load your account</h1>
          <p className="text-sm text-subtle">
            Something went wrong. Check your connection and try again.
          </p>
        </div>
        <PrimaryButton onClick={() => void refreshSession()}>Try again</PrimaryButton>
      </div>
    );
  }

  async function savePhone(): Promise<void> {
    if (!isNigerianPhoneDigits(phoneDigits)) {
      setPhoneError('Enter a valid Nigerian phone number.');
      return;
    }
    setSavingPhone(true);
    setPhoneError(null);
    try {
      const result = await updatePhone(toLocalPhone(phoneDigits));
      setPhoneDraft({
        userId: result.data.id,
        digits: result.data.phone ? normalizePhoneInput(result.data.phone) : '',
      });
      acceptAuthenticatedUser(result.data);
      // The number changed, so any code sent for the previous one no longer applies.
      setCodeSent(false);
      setPhoneCode('');
      setPhoneNotice(null);
      setCodeError(null);
    } catch (error: unknown) {
      setPhoneError(authErrorMessage(error));
    } finally {
      setSavingPhone(false);
    }
  }

  function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePhone();
  }

  /** POST /auth/send-phone-verification — SMS code to the number on the account. */
  async function sendVerificationCode(): Promise<void> {
    if (!user) {
      return;
    }
    setSendingCode(true);
    setPhoneError(null);
    setPhoneNotice(null);
    try {
      await sendPhoneVerification(user.email);
      setCodeSent(true);
      setPhoneNotice(
        `We sent a 6-digit code to ${formatPhoneDisplay(user.phone ?? '')}. It expires in 10 minutes.`,
      );
    } catch (error: unknown) {
      setPhoneError(authErrorMessage(error));
    } finally {
      setSendingCode(false);
    }
  }

  /** POST /auth/verify-phone — `{ token }` is the 6-digit SMS code. */
  async function handleVerifyPhone(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!user) {
      return;
    }
    if (!/^\d{6}$/.test(phoneCode)) {
      setCodeError('Enter the 6-digit code we texted you.');
      return;
    }
    setVerifyingPhone(true);
    setCodeError(null);
    setPhoneNotice(null);
    try {
      await verifyPhone(phoneCode);
      // The endpoint returns `{ data: { verified } }`, not the user, so mirror it locally.
      acceptAuthenticatedUser({ ...user, phoneVerifiedAt: new Date().toISOString() });
      setCodeSent(false);
      setPhoneCode('');
      setPhoneNotice('Phone number verified.');
    } catch (error: unknown) {
      setCodeError(authErrorMessage(error));
    } finally {
      setVerifyingPhone(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-bold text-ink">You&apos;re signed in</h1>
        <p className="text-sm text-subtle">Hi {user.firstName}, this is your Sellonit account.</p>
      </div>
      <ul className="flex flex-col gap-3 border-t border-line pt-5">
        <AccountRow label="Email" value={user.email} />
        <AccountRow
          label="Phone"
          value={user.phone ? formatPhoneDisplay(user.phone) : 'Not provided'}
        />
        <AccountRow label="Email verification" verified={Boolean(user.emailVerifiedAt)} />
        <AccountRow label="Phone verification" verified={Boolean(user.phoneVerifiedAt)} />
      </ul>
      <form
        className="flex flex-col gap-3 border-t border-line pt-5"
        onSubmit={handlePhoneSubmit}
        noValidate
      >
        <PhoneField
          id="account-phone"
          value={phoneDigits}
          onChange={(value) => {
            setPhoneDraft({ userId: user.id, digits: normalizePhoneInput(value) });
            setPhoneError(null);
          }}
          error={phoneError !== null}
          disabled={savingPhone}
        />
        <button
          type="submit"
          disabled={savingPhone}
          className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingPhone ? 'Saving…' : user.phone ? 'Update phone' : 'Add phone'}
        </button>
      </form>
      {user.phone && !user.phoneVerifiedAt ? (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          {codeSent ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => void handleVerifyPhone(event)}
              noValidate
            >
              <TextField
                id="phone-verification-code"
                label="Verification code"
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={phoneCode}
                onChange={(value) => {
                  setPhoneCode(value.replace(/\D/g, '').slice(0, 6));
                  setCodeError(null);
                }}
                error={codeError}
                disabled={verifyingPhone}
              />
              <button
                type="submit"
                disabled={verifyingPhone || phoneCode.length !== 6}
                className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {verifyingPhone ? 'Verifying…' : 'Verify phone'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => void sendVerificationCode()}
              disabled={sendingCode || savingPhone}
              className="self-start rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {sendingCode ? 'Sending…' : 'Send verification code'}
            </button>
          )}
        </div>
      ) : null}
      {phoneError ? <InlineError>{phoneError}</InlineError> : null}
      {phoneNotice ? (
        <p aria-live="polite" className="text-sm text-success">
          {phoneNotice}
        </p>
      ) : null}
      {!user.emailVerifiedAt ? (
        <p className="text-sm text-gray-500">
          Check your inbox for the verification link — you&apos;ll need it before you can log in.
        </p>
      ) : null}
    </div>
  );
}

function AccountRow({
  label,
  value,
  verified,
}: {
  label: string;
  value?: string;
  verified?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-subtle">{label}</span>
      {verified === undefined ? (
        <span className="break-words text-right font-semibold">{value}</span>
      ) : (
        <span
          className={
            verified
              ? 'rounded-full bg-success/10 px-3 py-0.5 text-xs font-semibold text-success'
              : 'rounded-full bg-canvas px-3 py-0.5 text-xs font-semibold text-subtle'
          }
        >
          {verified ? 'Verified' : 'Pending'}
        </span>
      )}
    </li>
  );
}
