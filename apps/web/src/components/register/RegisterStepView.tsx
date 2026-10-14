'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRegisterFlow } from './RegisterFlowContext';
import { REGISTER_STEPS, type RegisterStepId } from './registerSteps';

/**
 * Renders one registration step, after checking that it may be entered. A step
 * whose prerequisites are missing (for example, verify without a phone number)
 * redirects to the first step instead of rendering.
 */
export function RegisterStepView({ stepId }: { stepId: RegisterStepId }) {
  const router = useRouter();
  const { state } = useRegisterFlow();
  const step = REGISTER_STEPS.find((candidate) => candidate.id === stepId);
  const allowed = step ? step.canEnter(state) : false;
  const firstStepPath = REGISTER_STEPS[0].path;

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
