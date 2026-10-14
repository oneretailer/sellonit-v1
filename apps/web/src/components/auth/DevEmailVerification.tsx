'use client';

// DEV-ONLY-REMOVE: development convenience using the real verification endpoint.
export function DevEmailVerification({
  token,
  busy,
  verify,
}: {
  token?: string;
  busy: boolean;
  verify: (token: string) => void;
}) {
  if (process.env.NODE_ENV === 'production' || !token) return null;
  return (
    <div className="alert">
      <p className="field-helper">Development only — email verification token</p>
      <p className="account-value">{token}</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => verify(token)}>
        Verify email (development only)
      </button>
    </div>
  );
}
