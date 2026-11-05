'use client';

/**
 * Central unsaved-changes guard. The Add/Edit product form registers a guard
 * while dirty; sidebar links, the breadcrumb, Cancel and the business switcher
 * all route through it, so the discard confirmation lives in ONE place.
 *
 * The form also installs its own `beforeunload` listener while dirty.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass } from './Dialog';
import { Spinner } from '@/components/reuseable/Spinner';

export type UnsavedGuard = {
  isDirty: boolean;
  /** Delete session-only uploads / reset form state before leaving. */
  onDiscard: () => void | Promise<void>;
};

type PendingAction = {
  title: string;
  description: string;
  discardLabel: string;
  keepLabel: string;
  run: () => void;
};

type NavigationGuardValue = {
  registerGuard: (guard: UnsavedGuard | null) => void;
  /** True when a dirty guard is registered right now. */
  isDirty: () => boolean;
  /** Navigate to an href, confirming first when a dirty guard is registered. */
  navigate: (href: string) => void;
  /** Run any action (e.g. switch business), confirming first when dirty. */
  runGuarded: (action: Omit<PendingAction, 'run'> & { run: () => void }) => void;
};

const NavigationGuardContext = createContext<NavigationGuardValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guardRef = useRef<UnsavedGuard | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const registerGuard = useCallback((guard: UnsavedGuard | null) => {
    guardRef.current = guard;
  }, []);

  const runGuarded = useCallback((action: PendingAction) => {
    const guard = guardRef.current;
    if (!guard?.isDirty) { action.run(); return; }
    setPending(action);
  }, []);

  const navigate = useCallback((href: string) => {
    runGuarded({
      title: 'Discard this product?',
      description: "You have unsaved changes. If you leave now, what you've entered won't be kept.",
      discardLabel: 'Discard',
      keepLabel: 'Keep editing',
      run: () => router.push(href),
    });
  }, [router, runGuarded]);

  async function confirmDiscard() {
    if (!pending || discarding) return;
    setDiscarding(true);
    try {
      await guardRef.current?.onDiscard();
    } finally {
      guardRef.current = null;
      const action = pending;
      setPending(null);
      setDiscarding(false);
      action.run();
    }
  }

  const isDirty = useCallback(() => guardRef.current?.isDirty === true, []);
  const value = useMemo(() => ({ registerGuard, isDirty, navigate, runGuarded }), [registerGuard, isDirty, navigate, runGuarded]);

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <Dialog
        open={pending !== null}
        tone="warning"
        title={pending?.title ?? ''}
        description={pending?.description ?? ''}
        onClose={() => { if (!discarding) setPending(null); }}
        closeLocked={discarding}
        actions={<>
          <button type="button" className={dialogSecondaryClass} disabled={discarding} onClick={() => void confirmDiscard()}>
            {pending?.discardLabel ?? 'Discard'}
          </button>
          <button type="button" data-dialog-safe className={dialogPrimaryClass} disabled={discarding} onClick={() => setPending(null)}>
            {discarding ? <Spinner /> : null}
            {pending?.keepLabel ?? 'Keep editing'}
          </button>
        </>}
      />
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuardValue {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error('useNavigationGuard must be used within NavigationGuardProvider.');
  return context;
}

/** Optional variant for components that may render outside the provider (tests). */
export function useOptionalNavigationGuard(): NavigationGuardValue | null {
  return useContext(NavigationGuardContext);
}
