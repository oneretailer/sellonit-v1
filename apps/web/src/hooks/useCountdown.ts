'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Whole-second countdown. `remaining` ticks down once per second until it
 * reaches 0; `restart()` begins a fresh countdown from `seconds`.
 */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const restart = useCallback(() => setRemaining(seconds), [seconds]);

  return { remaining, restart };
}
