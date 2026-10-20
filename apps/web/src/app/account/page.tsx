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
    <div className=''>
      <AuthPage>
      <AuthCard className="items-stretch text-left">
        <AccountPanel />
      </AuthCard>
    </AuthPage>
    </div>
  );
}
