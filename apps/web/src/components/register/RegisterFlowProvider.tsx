'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useReducer, type ReactNode } from 'react';
import { RegisterFlowContext, type RegisterFlowContextValue } from './RegisterFlowContext';
import {
  initialRegisterFlowState,
  registerFlowReducer,
  type RegisteredAccount,
  type RegisterFlowState,
} from './registerFlowReducer';
import { nextRegisterStep, REGISTER_STEPS, type RegisterStepId } from './registerSteps';

/**
 * Step controller for registration. It holds the data collected across steps
 * and performs navigation. It lives in the `register` layout, so the state
 * survives moves between steps. A hard refresh resets it, and the step gate
 * then sends the user back to the first step.
 */
export function RegisterFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(registerFlowReducer, initialRegisterFlowState);

  const saveName = useCallback((firstName: string, lastName: string) => {
    dispatch({ type: 'nameSaved', firstName, lastName });
  }, []);

  const saveEmail = useCallback((email: string) => {
    dispatch({ type: 'emailSaved', email });
  }, []);

  const savePassword = useCallback((password: string) => {
    dispatch({ type: 'passwordSaved', password });
  }, []);

  const savePhone = useCallback((phone: string | null) => {
    dispatch({ type: 'phoneSaved', phone });
  }, []);

  const markRegistered = useCallback((account: RegisteredAccount) => {
    dispatch({ type: 'registered', account });
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

  const goToNextStep = useCallback(
    (id: RegisterStepId, nextState: RegisterFlowState = state) => {
      const next = nextRegisterStep(id, nextState);
      if (next) {
        router.push(next.path);
      }
    },
    [router, state],
  );

  const value = useMemo<RegisterFlowContextValue>(
    () => ({
      state,
      saveName,
      saveEmail,
      savePassword,
      savePhone,
      markRegistered,
      markPhoneVerified,
      goToStep,
      goToNextStep,
    }),
    [
      state,
      saveName,
      saveEmail,
      savePassword,
      savePhone,
      markRegistered,
      markPhoneVerified,
      goToStep,
      goToNextStep,
    ],
  );

  return <RegisterFlowContext.Provider value={value}>{children}</RegisterFlowContext.Provider>;
}
