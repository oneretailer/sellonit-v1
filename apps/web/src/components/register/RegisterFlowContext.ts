'use client';

import { createContext, useContext } from 'react';
import type { RegisterFlowState } from './registerFlowReducer';
import type { RegisterStepId } from './registerSteps';

export type RegisterFlowContextValue = {
  /** Data collected so far. */
  state: RegisterFlowState;
  /** Stores the phone digits. Changing the number clears its verification. */
  savePhone: (digits: string) => void;
  markPhoneVerified: () => void;
  /** Navigates to a step. Previously collected data is kept. */
  goToStep: (id: RegisterStepId) => void;
  /** Navigates to the step after `id`. Does nothing if `id` is the last step. */
  goToNextStep: (id: RegisterStepId) => void;
  /** Whether a step follows `id` in the ordered step list. */
  hasNextStep: (id: RegisterStepId) => boolean;
};

export const RegisterFlowContext = createContext<RegisterFlowContextValue | null>(null);

/** Access to the registration step controller. Must be used inside the flow's provider. */
export function useRegisterFlow(): RegisterFlowContextValue {
  const value = useContext(RegisterFlowContext);
  if (!value) {
    throw new Error('useRegisterFlow must be used inside <RegisterFlowProvider>.');
  }
  return value;
}
