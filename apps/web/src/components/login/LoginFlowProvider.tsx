'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LOGIN_STEPS, type LoginFlowState, type LoginStepId } from './loginSteps';

type LoginFlowContextValue = {
  state: LoginFlowState;
  saveEmail: (email: string) => void;
  goToStep: (id: LoginStepId) => void;
};

const LoginFlowContext = createContext<LoginFlowContextValue | null>(null);

/** Access to the login step controller. Must be used inside the login layout. */
export function useLoginFlow(): LoginFlowContextValue {
  const value = useContext(LoginFlowContext);
  if (!value) {
    throw new Error('useLoginFlow must be used inside <LoginFlowProvider>.');
  }
  return value;
}

/** Holds the email between the login steps. The password is never stored here. */
export function LoginFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<LoginFlowState>({ email: null });

  const saveEmail = useCallback((email: string) => {
    setState({ email });
  }, []);

  const goToStep = useCallback(
    (id: LoginStepId) => {
      const step = LOGIN_STEPS.find((candidate) => candidate.id === id);
      if (step) {
        router.push(step.path);
      }
    },
    [router],
  );

  const value = useMemo(() => ({ state, saveEmail, goToStep }), [state, saveEmail, goToStep]);

  return <LoginFlowContext.Provider value={value}>{children}</LoginFlowContext.Provider>;
}
