'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { AppleMark, GoogleMark } from '@/components/reuseable/SocialProviderMarks';

export function SignupMethodChooser() {
  const router = useRouter();
  return (
    <AuthCard gapClassName="gap-6 md:gap-12">
      <AuthCardHeader
        icon={<BagMark className="w-9 text-primary md:w-14" />}
        title="Create your sellonit account"
      >
        Choose how you&apos;d like to get started
      </AuthCardHeader>

      <div className="flex w-full flex-col text-left">
        {/* TODO(google-auth): provide a provider handler or OAuth redirect URL. */}
        {/* TODO(apple-auth): provide a provider handler or OAuth redirect URL. */}
        <div className="flex w-full flex-col gap-4">
          <SecondaryButton
            shape="rounded"
            appearance="outline"
            aria-disabled="true"
            className="text-lg"
          >
            Sign up with Google <GoogleMark className="size-6" />
          </SecondaryButton>
          <SecondaryButton
            shape="rounded"
            appearance="outline"
            aria-disabled="true"
            className="text-lg"
          >
            Sign up with Apple <AppleMark className="size-6" />
          </SecondaryButton>
        </div>
        <p className="py-6 text-center text-sm font-bold text-ink">OR</p>
        <PrimaryButton
          shape="rounded"
          onClick={() => router.push('/auth/register/account-details')}
          className="text-xl sm:text-2xl"
        >
          Continue with email
        </PrimaryButton>
      </div>

      <p className="text-center text-base text-subtle sm:text-lg">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-semibold text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
