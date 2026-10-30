import type { Metadata } from 'next';
import { AccountPanel } from '@/components/auth/AccountPanel';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your Sellonit account.',
};

export default function AccountPage() {
  return (
    <div className="">
      <AuthPage>
        <div className="pt-15 w-full flex items-center justify-center">
          <AuthCard className="items-stretch text-left">
            <AccountPanel />
          </AuthCard>
        </div>
      </AuthPage>
    </div>
  );
}
