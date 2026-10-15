'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * One URL search param as state: `const [status, setStatus] = useQueryState('status')`.
 * Empty / null removes the param. Changing any param other than `page` resets `page`.
 * Components using it must sit inside a <Suspense> boundary (useSearchParams).
 */
export function useQueryState(key: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setValue = useCallback(
    (next: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (next) sp.set(key, next);
      else sp.delete(key);
      if (key !== 'page') sp.delete('page');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, params, pathname, router],
  );

  return [params.get(key) ?? '', setValue] as const;
}
