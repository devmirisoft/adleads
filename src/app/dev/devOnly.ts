import { notFound } from 'next/navigation';

/**
 * First line of every dev page. dev/layout.tsx isn't enough: client navigations and RSC requests skip
 * layouts. The proxy gives production its real 404 status, but its matcher skips paths with a dot.
 */
export function devOnly() {
  if (process.env.NODE_ENV === 'production') notFound();
}
