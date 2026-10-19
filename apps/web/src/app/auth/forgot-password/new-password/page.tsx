import type { Metadata } from 'next';
import { NewPasswordForm } from '@/components/password-reset/NewPasswordForm';

export const metadata: Metadata = {
  title: 'Create a new password',
};

/** Forgot password, step 3: choose a new password. */
export default function ForgotPasswordNewPasswordPage() {
  return <NewPasswordForm />;
}
