import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <AuthPage rightLink={{ label: 'Learn more', href: '/learn-more', variant: 'pill' }}>
      <AuthCard className="min-h-[480px] justify-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">Build your business on sellonit</h1>
          <p className="max-w-sm text-sm text-subtle">
            Create your account and set up the business you want to run on your platform
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-5">
          <PrimaryLinkButton href="/auth/register/name">Get Started</PrimaryLinkButton>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-subtle underline-offset-2 hover:text-ink hover:underline"
          >
            Log in
          </Link>
        </div>
      </AuthCard>
    </AuthPage>
  );
}
