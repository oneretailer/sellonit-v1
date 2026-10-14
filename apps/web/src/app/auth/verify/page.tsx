import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyPhoneForm } from '@/components/auth/VerifyPhoneForm';

export const metadata: Metadata = {
  title: 'Verify your phone number',
  description: 'Enter the 6-digit code we sent to your phone.',
};

export default function VerifyPage() {
  return (
    <AuthShell nav={{ label: 'Log in', href: '/auth/login' }}>
      <VerifyPhoneForm />
    </AuthShell>
  );
}
