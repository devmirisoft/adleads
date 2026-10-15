import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { config } from '@/lib/config';

/** Cron routes are public in proxy.ts; this header is their only guard. */
export function isCronRequest(req: Request): boolean {
  const given = Buffer.from(req.headers.get('x-cron-secret') ?? '');
  const expected = Buffer.from(config.CRON_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const unauthorized = () => Response.json({ error: 'Bad cron secret' }, { status: 401 });
