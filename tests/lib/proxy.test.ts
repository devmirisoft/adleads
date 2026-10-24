import { describe, expect, it } from 'vitest';
import { config } from '@/proxy';

// For plain paths Next compiles the matcher to this same anchored regex (plus optional .rsc/.json suffixes).
const runsOn = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe('proxy matcher', () => {
  it.each([
    '/',
    '/privacy',
    '/terms',
    '/refund-policy',
    '/contact',
    '/login',
    '/api/webhooks/whatsapp',
    '/api/auth/session',
    '/api/cron/jobs',
    '/robots.txt',
    '/hero.jpg',
    '/_next/static/chunk.js',
  ])('skips the auth check on %s', (path) => {
    expect(runsOn(path)).toBe(false);
  });

  it.each([
    '/dashboard',
    '/leads/abc',
    '/settings',
    '/api/admin/leads',
    '/dev/ui',
    '/contacts',
    '/terms-old',
    '/privacy/x',
  ])('guards %s', (path) => {
    expect(runsOn(path)).toBe(true);
  });
});
