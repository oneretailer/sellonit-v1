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
    <div className="pt-15 w-full flex items-center justify-center">
      <AuthCard gapClassName="gap-9 pt-10 md:gap-12">
        <AuthCardHeader icon={<BagMark />} title="Create your sellonit account">
          <span className="text-[15px]"> Choose how you&apos;d like to get started</span>
        </AuthCardHeader>

        <div className="flex w-full flex-col  text-left">
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
          <p className="py-6 text-center text-sm font-semibold text-ink">OR</p>
          <PrimaryButton
            shape="pill"
            onClick={() => router.push('/auth/register/account-details')}
            className="text-xl sm:text-2xl"
          >
            <span className="text-black">Continue with email</span>
          </PrimaryButton>
        </div>

        <p
          className="text-center text-base pb-3
       text-subtle sm:text-lg"
        >
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-ink underline underline-offset-2">
            Log in
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
