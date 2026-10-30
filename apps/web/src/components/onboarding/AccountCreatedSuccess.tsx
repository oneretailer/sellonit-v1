'use client';

import { useEffect, useRef } from 'react';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { SuccessCheckIcon } from './SuccessCheckIcon';

function SharedSizeBagMark() {
  return (
    <span>
      <BagMark />
    </span>
  );
}

export function AccountCreatedSuccess() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="pt-15 w-full flex items-center justify-center">
      <AuthCard gapClassName="gap-6 md:gap-9">
        <AuthCardHeader
          icon={<SharedSizeBagMark />}
          headingRef={headingRef}
          headingTabIndex={-1}
          title="Account successfully created"
        />
        <div className="flex items-center justify-center w-full">
          <SuccessCheckIcon />
        </div>
        <p className="mx-auto max-w-[360px] text-base font-medium text-ink md:text-lg xl:text-xl">
          Click on the button below to set up your business account
        </p>
        <PrimaryLinkButton href="/auth/role-selection" className="auth-button text-ink">
          Set up your Business account
        </PrimaryLinkButton>
      </AuthCard>
    </div>
  );
}
