import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell nav={{ label: 'Log in', href: '/auth/login' }}>
      <VerifyEmailForm linkToken={typeof token === 'string' ? token : null} />
    </AuthShell>
  );
}
