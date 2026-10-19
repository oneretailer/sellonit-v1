import { redirect } from 'next/navigation';

type LegacyVerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

/**
 * Legacy link target. The pre-contract backend emails link to
 * `/verify-email?token=...`; the canonical landing route is now
 * `/auth/verify-email/confirm?token=...` (see docs/auth-registration-contract.md).
 * This redirect keeps old emails working. Safe to remove once no unexpired
 * email still carries the old link.
 */
export default async function LegacyVerifyEmailPage({ searchParams }: LegacyVerifyEmailPageProps) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  redirect(
    value ? `/auth/verify-email/confirm?token=${encodeURIComponent(value)}` : '/auth/verify-email',
  );
}
