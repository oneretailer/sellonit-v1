'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { LoadingState } from './StatePanel';

const enabled = process.env.NEXT_PUBLIC_API_MOCK === 'true';
let workerPromise: Promise<unknown> | null = null;
export function MockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!enabled);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    workerPromise ??= import('@/mocks/browser').then(({ worker }) => worker.start({ quiet: true, serviceWorker: { url: '/mockServiceWorker.js' } }));
    void workerPromise.then(() => { if (active) setReady(true); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  if (error) return <main className="p-6"><p role="alert">The API mock worker could not start. Reload this page to try again.</p></main>;
  return ready ? children : <main className="mx-auto max-w-3xl p-6"><LoadingState label="Starting API mocks" /></main>;
}
