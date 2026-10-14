import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Sellonit account.',
};

export default function LoginPage() {
  return (
    <AuthPage rightLink={{ label: 'Create account', href: '/auth/register/phone' }}>
      <AuthCard className="items-stretch text-left">
        <LoginForm />
      </AuthCard>
    </AuthPage>
  );
}
