'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useReducer, type ReactNode } from 'react';
import { RegisterFlowContext, type RegisterFlowContextValue } from './RegisterFlowContext';
import { initialRegisterFlowState, registerFlowReducer } from './registerFlowReducer';
import { REGISTER_STEPS, type RegisterStepId } from './registerSteps';

/**
 * Step controller for registration. It holds the data collected across steps
 * and performs navigation. It lives in the `register` layout, so the state
 * survives moves between steps. A hard refresh resets it, and the step gate
 * then sends the user back to the first step.
 */
export function RegisterFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(registerFlowReducer, initialRegisterFlowState);

  const savePhone = useCallback((phone: string) => {
    dispatch({ type: 'phoneSaved', phone });
  }, []);

  const markPhoneVerified = useCallback(() => {
    dispatch({ type: 'phoneVerified' });
  }, []);

  const goToStep = useCallback(
    (id: RegisterStepId) => {
      const step = REGISTER_STEPS.find((candidate) => candidate.id === id);
      if (step) {
        router.push(step.path);
      }
    },
    [router],
  );

  const indexOf = useCallback(
    (id: RegisterStepId) => REGISTER_STEPS.findIndex((candidate) => candidate.id === id),
    [],
  );

  const hasNextStep = useCallback(
    (id: RegisterStepId) => indexOf(id) < REGISTER_STEPS.length - 1,
    [indexOf],
  );

  const goToNextStep = useCallback(
    (id: RegisterStepId) => {
      const next = REGISTER_STEPS[indexOf(id) + 1];
      if (next) {
        router.push(next.path);
      }
    },
    [indexOf, router],
  );

  const value = useMemo<RegisterFlowContextValue>(
    () => ({
      state,
      savePhone,
      markPhoneVerified,
      goToStep,
      goToNextStep,
      hasNextStep,
    }),
    [state, savePhone, markPhoneVerified, goToStep, goToNextStep, hasNextStep],
  );

  return <RegisterFlowContext.Provider value={value}>{children}</RegisterFlowContext.Provider>;
}
