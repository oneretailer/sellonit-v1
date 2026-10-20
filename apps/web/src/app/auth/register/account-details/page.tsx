import type { Metadata } from 'next';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';

export const metadata: Metadata = {
  title: 'Set up your account',
  description: 'Tell us a little about yourself.',
};

export default function AccountDetailsPage() {
  return (
    <div className='pt-15 w-full flex items-center justify-center'>
     < AuthCard gapClassName="gap-6 md:gap-12">
      <AuthCardHeader
        icon={<BagMark className="w-9 text-primary md:w-14" />}
        title="Set up your account"
      >
        Tell us a little about yourself
      </AuthCardHeader>
      <CreateAccountForm />
    </AuthCard>
    </div>
  );
}
