import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { config } from '@/lib/config';

const matchesSecret = (value: string | null | undefined) => {
  const given = Buffer.from(value ?? '');
  const expected = Buffer.from(config.CRON_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

/**
 * Cron routes are public in proxy.ts; the secret is their only guard.
 * Accepted as `x-cron-secret` (crontab.txt) or `Authorization: Bearer` (Vercel Cron).
 */
export function isCronRequest(req: Request): boolean {
  const bearer = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  return matchesSecret(req.headers.get('x-cron-secret')) || matchesSecret(bearer);
}

export const unauthorized = () => Response.json({ error: 'Bad cron secret' }, { status: 401 });
