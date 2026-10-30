import type { Metadata } from 'next';
import { ResetSuccess } from '@/components/password-reset/ResetSuccess';

export const metadata: Metadata = {
  title: 'Password updated',
};

/** Forgot password, final step: success. */
export default function ForgotPasswordSuccessPage() {
  return (
    <>
      <div className="pt-15 w-full flex items-center justify-center">
        <ResetSuccess />
      </div>
    </>
  );
}
