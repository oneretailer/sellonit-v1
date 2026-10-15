import type { Metadata } from 'next';
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Verify your Sellonit email address.',
};

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

/** Target of the verification email link. The token is sent once, by the client, to the API. */
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  return (
    <AuthPage rightLink={{ label: 'Log in', href: '/auth/login/email' }}>
      <VerifyEmailPanel token={value && /^[a-f0-9]{64}$/i.test(value) ? value : null} />
    </AuthPage>
  );
}
