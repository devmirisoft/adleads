'use client';

import { useEffect, useRef } from 'react';

/** Returns `fn` wrapped so it runs `ms` after the last call. */
export function useDebounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (...args: A) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), ms);
  };
}
