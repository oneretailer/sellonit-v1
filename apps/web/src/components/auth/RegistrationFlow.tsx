'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { RegisterRequest, RegisterResponse } from '@/lib/auth/types';

export const REGISTRATION_STEPS = [
  '/auth/register',
  '/auth/register/phone',
  '/auth/verify',
  '/verify-email',
  '/auth/login',
] as const;
type State = {
  details?: RegisterRequest;
  registration?: RegisterResponse;
  phoneVerified?: boolean;
};
type Action =
  | { type: 'details'; details: RegisterRequest }
  | { type: 'registered'; registration: RegisterResponse }
  | { type: 'phoneVerified' };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'details':
      return { details: action.details };
    case 'registered':
      return { registration: action.registration };
    case 'phoneVerified':
      return { ...state, phoneVerified: true };
  }
}
const Context = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  next: (current: (typeof REGISTRATION_STEPS)[number], phone?: boolean) => void;
} | null>(null);
export function RegistrationFlow({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {});
  const router = useRouter();
  function next(current: (typeof REGISTRATION_STEPS)[number], phone = true) {
    const remaining = REGISTRATION_STEPS.slice(REGISTRATION_STEPS.indexOf(current) + 1);
    const target = remaining.find((step) => phone || step !== '/auth/verify');
    if (target) router.replace(target);
  }
  return <Context.Provider value={{ state, dispatch, next }}>{children}</Context.Provider>;
}
export function useRegistration() {
  const value = useContext(Context);
  if (!value) throw new Error('RegistrationFlow is required');
  return value;
}
export function RegistrationGuard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!allowed) router.replace('/auth/register');
  }, [allowed, router]);
  return allowed ? children : <p className="field-helper">Returning to account details…</p>;
}
