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

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const ToastContext = createContext<((message: string, tone?: Toast['tone']) => void) | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
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
        className="pointer-events-none fixed inset-x-4 bottom-5 z-[80] flex justify-center"
      >
        {toast ? (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-xl items-center gap-4 rounded-2xl border bg-white px-5 py-4 text-sm shadow-lg ${toast.tone === 'error' ? 'border-danger text-danger' : 'border-success text-ink'}`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
              className="min-h-11 min-w-11 rounded-xl text-xl hover:bg-gray-50"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast requires ToastProvider.');
  return notify;
}
