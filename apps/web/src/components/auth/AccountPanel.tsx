'use client';

import { useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PhoneField } from '@/components/reuseable/PhoneField';
import { PrimaryButton, PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { updatePhone } from '@/lib/auth/api';
import { ApiError } from '@/lib/api-client';
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
    } catch (error: unknown) {
      setPhoneError(
        error instanceof ApiError ? error.message : 'We could not save your phone number.',
      );
    } finally {
      setSavingPhone(false);
    }
  }

  function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePhone();
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
        {phoneError ? <InlineError id="account-phone-error">{phoneError}</InlineError> : null}
        <button
          type="submit"
          disabled={savingPhone}
          className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingPhone ? 'Saving…' : user.phone ? 'Update phone' : 'Add phone'}
        </button>
      </form>
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
