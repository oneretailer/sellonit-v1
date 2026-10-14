'use client';

import { createContext, useContext } from 'react';
import type { RegisteredAccount, RegisterFlowState } from './registerFlowReducer';
import type { RegisterStepId } from './registerSteps';

export type RegisterFlowContextValue = {
  /** Data collected so far. */
  state: RegisterFlowState;
  saveName: (firstName: string, lastName: string) => void;
  saveEmail: (email: string) => void;
  savePassword: (password: string) => void;
  /** Stores the phone digits (or null when skipped). Changing the number clears its verification. */
  savePhone: (phone: string | null) => void;
  /** Records the account created by POST /auth/register and drops the password. */
  markRegistered: (account: RegisteredAccount) => void;
  markPhoneVerified: () => void;
  /** Navigates to a step. Collected data is kept. */
  goToStep: (id: RegisterStepId) => void;
  /**
   * Navigates to the next step that applies. Steps that are skipped (for
   * example verify-phone without a phone number) are passed over. Pass `state`
   * when the step has just changed data, because the state from this render
   * is not yet updated.
   */
  goToNextStep: (id: RegisterStepId, state?: RegisterFlowState) => void;
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
