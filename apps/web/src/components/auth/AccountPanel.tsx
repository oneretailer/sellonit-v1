'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PhoneField } from '@/components/reuseable/PhoneField';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { getMe, updatePhone } from '@/lib/auth/api';
import { ApiError } from '@/lib/api-client';
import {
  formatPhoneDisplay,
  isNigerianPhoneDigits,
  normalizePhoneInput,
  toLocalPhone,
} from '@/lib/auth/validation';
import type { AuthUser } from '@/lib/auth/types';

type PanelState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error' }
  | { status: 'user'; user: AuthUser };

/**
 * Minimal signed-in confirmation. It only reads GET /auth/me with the
 * browser-managed session cookie; no tokens are stored or read client-side.
 * The backend does not expose a logout endpoint, so none is offered.
 */
export function AccountPanel() {
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getMe();
        if (!cancelled) {
          setState({ status: 'user', user: result.data });
          setPhoneDigits(result.data.phone ? normalizePhoneInput(result.data.phone) : '');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'signedOut' });
        } else {
          setState({ status: 'error' });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <span
          className="size-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500">Checking your session…</p>
      </div>
    );
  }

  if (state.status === 'signedOut') {
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

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-ink">We couldn&apos;t load your account</h1>
          <p className="text-sm text-subtle">
            Something went wrong. Check your connection and try again.
          </p>
        </div>
        <PrimaryLinkButton href="/auth/login">Log in</PrimaryLinkButton>
      </div>
    );
  }

  const { user } = state;
  function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isNigerianPhoneDigits(phoneDigits)) {
      setPhoneError('Enter a valid Nigerian phone number.');
      return;
    }
    setSavingPhone(true);
    setPhoneError(null);
    void updatePhone(toLocalPhone(phoneDigits))
      .then((result) => setState({ status: 'user', user: result.data }))
      .catch((error: unknown) => {
        setPhoneError(
          error instanceof ApiError ? error.message : 'We could not save your phone number.',
        );
      })
      .finally(() => setSavingPhone(false));
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
            setPhoneDigits(normalizePhoneInput(value));
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
        <span className="text-right font-semibold break-words">{value}</span>
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
