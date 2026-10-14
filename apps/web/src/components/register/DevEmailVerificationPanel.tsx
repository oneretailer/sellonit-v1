// DEV-ONLY-REMOVE
'use client';

import { useState } from 'react';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { verifyEmail } from '@/lib/auth/api';
import { emailLinkErrorMessage } from '@/lib/auth/errors';

type PanelStatus = 'idle' | 'working' | 'done' | 'error';

/**
 * DEV-ONLY-REMOVE — delete this file and its import in CheckEmailStep.tsx before release.
 *
 * Outside production, POST /auth/register returns the email verification token
 * in the response. There is no inbox in local development, so this panel lets
 * a developer verify the account without the email. It is never rendered when
 * NODE_ENV is "production".
 */
export function DevEmailVerificationPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  async function verify() {
    setStatus('working');
    setMessage(null);
    try {
      await verifyEmail(token);
      setStatus('done');
      setMessage('Email verified. Log in to continue.');
    } catch (err) {
      setStatus('error');
      setMessage(emailLinkErrorMessage(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-dashed border-gray-400 p-4 text-left text-xs text-gray-600">
      <p className="font-bold uppercase tracking-wide">Dev only · remove before release</p>
      <p>
        Email verification token from the register response. The email link is
        <br />
        <code className="break-all font-mono">/verify-email?token={token}</code>
      </p>
      <PrimaryButton
        type="button"
        onClick={() => void verify()}
        loading={status === 'working'}
        disabled={status === 'done'}
        className="h-10 text-sm"
      >
        Verify email now
      </PrimaryButton>
      {message ? (
        <p role="status" className={status === 'error' ? 'text-danger' : 'text-gray-700'}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
