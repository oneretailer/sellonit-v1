'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StepHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { useForgotPasswordFlow } from './FlowProvider';

/**
 * Password updated (Figma: success). Shown only after a successful reset in
 * this page session. A refreshed or directly opened success page has no
 * completion flag, so it sends the user to log in.
 */
export function ResetSuccess() {
  const router = useRouter();
  const resetFlow = useForgotPasswordFlow();
  const completed = resetFlow?.completed ?? false;

  useEffect(() => {
    if (!completed) {
      router.replace('/auth/login');
    }
  }, [completed, router]);

  if (!completed) {
    return null;
  }

  return (
    <AuthCard gapClassName="gap-9">
      <StepHeader title="Password updated 😄🎉" icon={<BagMark />}>
        Your password has been changed. You can now log in with your new password
      </StepHeader>
      <div className="flex w-full flex-col gap-3">
        <PrimaryLinkButton href="/auth/login">Log in</PrimaryLinkButton>
      </div>
    </AuthCard>
  );
}
