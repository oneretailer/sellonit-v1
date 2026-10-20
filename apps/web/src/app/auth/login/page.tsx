import type { Metadata } from 'next';
import { LoginForm } from '@/components/login/LoginForm';
import { isEmail } from '@/lib/auth/validation';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Sellonit account.',
};

type LoginPageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { email } = await searchParams;
  const value = Array.isArray(email) ? email[0] : email;
  const initialIdentifier = value && isEmail(value) ? value : undefined;
  return (
    <div className="pt-15 w-full flex items-center justify-center">
      <LoginForm initialIdentifier={initialIdentifier} />
    </div>
  );
}