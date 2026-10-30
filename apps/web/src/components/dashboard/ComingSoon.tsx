import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';
import Link from 'next/link';
import type { AuthUser } from '@/lib/auth/types';
import { getUserFullName } from './DashboardShell';

export function ComingSoon({ user }: { user: AuthUser }) {
  const firstName = user.firstName.trim().split(/\s+/)[0];
  return (
    <AuthPage>
      <AuthCard gapClassName="gap-6 md:gap-9">
        <AuthCardHeader icon={<BagMark />} title="Your dashboard is coming soon">
          We&apos;re building your workspace and we&apos;ll let you know when it&apos;s ready.
        </AuthCardHeader>
        <p className="text-sm text-subtle">
          {firstName ? `Welcome, ${firstName}.` : getUserFullName(user)}
        </p>
        <Link
          href="/auth/role-selection"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-primary-disabled px-6 text-base font-medium text-ink hover:bg-orange-100"
        >
          Change how I use Sellonit
        </Link>
      </AuthCard>
    </AuthPage>
  );
}
