import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailConfirm } from '@/components/auth/VerifyEmailConfirm';

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Verify your Sellonit email address.',
};

/**
 * Link landing route: /auth/verify-email/confirm?token=...
 * (the verification email's target — see docs/auth-registration-contract.md).
 * TODO: replace with Figma design. Minimal functional states only.
 */
export default function VerifyEmailConfirmPage() {
  return (
   <div className='pt-15 w-full flex items-center justify-center'>
      <Suspense>
      <VerifyEmailConfirm />
    </Suspense>
   </div>
  );
}
