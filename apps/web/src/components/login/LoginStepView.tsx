'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLoginFlow } from './LoginFlowProvider';
import { LOGIN_STEPS, type LoginStepId } from './loginSteps';

/** Renders one login step after checking it may be entered. Otherwise redirects to the email step. */
export function LoginStepView({ stepId }: { stepId: LoginStepId }) {
  const router = useRouter();
  const { state } = useLoginFlow();
  const step = LOGIN_STEPS.find((candidate) => candidate.id === stepId);
  const allowed = step ? step.canEnter(state) : false;
  const firstStepPath = LOGIN_STEPS[0].path;

  useEffect(() => {
    if (!allowed) {
      router.replace(firstStepPath);
    }
  }, [allowed, firstStepPath, router]);

  if (!step || !allowed) {
    return null;
  }

  const { Component } = step;
  return <Component />;
}
