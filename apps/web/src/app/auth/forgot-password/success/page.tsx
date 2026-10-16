import type { Metadata } from 'next';
import { ResetSuccess } from '@/components/password-reset/ResetSuccess';

export const metadata: Metadata = {
  title: 'Password updated',
};

/** Forgot password, final step: success. */
export default function ForgotPasswordSuccessPage() {
  return <ResetSuccess />;
}
