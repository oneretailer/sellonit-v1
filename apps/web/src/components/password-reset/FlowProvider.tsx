'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * In-memory state shared by the forgot-password screens. It lives in the
 * layout, so it survives client-side navigation between steps. It does NOT
 * survive a page refresh, by design:
 * - `resetToken` is never written to storage. After a refresh the
 *   new-password step sends the user back to the code step.
 * - `completed` is true only after a successful reset. The success screen
 *   checks it, so a refreshed success page cannot be reached directly.
 */
type ForgotPasswordFlowValue = {
  resetToken: string | null;
  setResetToken: (token: string | null) => void;
  completed: boolean;
  markCompleted: () => void;
};

const ForgotPasswordFlowContext = createContext<ForgotPasswordFlowValue | null>(null);

export function ForgotPasswordFlowProvider({ children }: { children: ReactNode }) {
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const markCompleted = useCallback(() => setCompleted(true), []);
  const value = useMemo(
    () => ({ resetToken, setResetToken, completed, markCompleted }),
    [resetToken, completed, markCompleted],
  );
  return (
    <ForgotPasswordFlowContext.Provider value={value}>
      {children}
    </ForgotPasswordFlowContext.Provider>
  );
}

/** Null outside the provider (for example on the verify-account page). */
export function useForgotPasswordFlow(): ForgotPasswordFlowValue | null {
  return useContext(ForgotPasswordFlowContext);
}
