'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * In-memory state shared by the forgot-password screens. It lives in the
 * layout, so it survives client-side navigation between steps. It does NOT
 * survive a page refresh, by design:
 * - `verifiedCode` is the 6-digit code that POST /auth/verification-codes/verify
 *   accepted. The backend issues no reset token, so this code is what
 *   POST /auth/reset-password re-checks. It is never written to storage, so a
 *   refresh sends the user back to the code step.
 * - `completed` is true only after a successful reset. The success screen
 *   checks it, so a refreshed success page cannot be reached directly.
 */
type ForgotPasswordFlowValue = {
  verifiedCode: string | null;
  setVerifiedCode: (code: string | null) => void;
  completed: boolean;
  markCompleted: () => void;
};

const ForgotPasswordFlowContext = createContext<ForgotPasswordFlowValue | null>(null);

export function ForgotPasswordFlowProvider({ children }: { children: ReactNode }) {
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const markCompleted = useCallback(() => setCompleted(true), []);
  const value = useMemo(
    () => ({ verifiedCode, setVerifiedCode, completed, markCompleted }),
    [verifiedCode, completed, markCompleted],
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
