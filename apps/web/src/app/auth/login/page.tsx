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
  // Only a well-formed email is accepted from the query string. Never a password.
  const { email } = await searchParams;
  const value = Array.isArray(email) ? email[0] : email;
  const initialIdentifier = value && isEmail(value) ? value : undefined;
  return <LoginForm initialIdentifier={initialIdentifier} />;
}
