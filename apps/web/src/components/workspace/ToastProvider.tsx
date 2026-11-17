'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error';

export type ToastInput =
  | string
  | {
      title: string;
      description?: string;
      tone?: ToastTone;
    };

type ToastState = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type NotifyFn = (input: ToastInput, tone?: ToastTone, description?: string) => void;

const ToastContext = createContext<NotifyFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback<NotifyFn>((input, tone = 'success', description) => {
    if (timer.current) clearTimeout(timer.current);
    const next: ToastState =
      typeof input === 'string'
        ? { id: Date.now(), title: input, description, tone }
        : {
            id: Date.now(),
            title: input.title,
            description: input.description,
            tone: input.tone ?? tone,
          };
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-20 z-[80] flex max-w-[calc(100vw-2rem)] justify-end sm:right-7"
      >
        {toast ? (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-ws-card border border-line bg-surface p-4 text-left shadow-ws-toast"
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                toast.tone === 'error'
                  ? 'bg-danger-tint text-danger'
                  : 'bg-success-tint text-success',
              )}
            >
              <DashboardIcon
                name={toast.tone === 'error' ? 'alert' : 'check-circle'}
                className="size-4"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-[length:var(--text-ws-body)] font-semibold',
                  toast.tone === 'error' ? 'text-danger' : 'text-ink',
                )}
              >
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-0.5 truncate text-[length:var(--text-ws-caption)] text-subtle">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
              className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-ws-control text-caption transition-colors hover:bg-canvas hover:text-ink"
            >
              <DashboardIcon name="close" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): NotifyFn {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast requires ToastProvider.');
  return notify;
}
