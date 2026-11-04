import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from '@/proxy';

// For plain paths Next compiles the matcher to this same anchored regex (plus optional .rsc/.json suffixes).
const runsOn = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

const request = (path: string, cookie = '') =>
  new NextRequest(`https://app.test${path}`, { headers: { cookie } });

const filesNamed = (name: string, dir: string) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => basename(f) === name)
    .map((f) => join(dir, f));

// The proxy only checks that a cookie exists, and client navigations skip layouts, so a page that
// relies on its layout's auth check is readable with any made-up cookie. Each one must check itself.
describe('checks the session itself', () => {
  it.each([
    ...filesNamed('page.tsx', 'src/app/(admin)'),
    ...filesNamed('page.tsx', 'src/app/dev/(tools)'),
    ...filesNamed('route.ts', 'src/app/api/admin'),
  ])('%s', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/requireUser|requireRole/);
  });
});

describe('proxy cookie check', () => {
  it.each([
    'authjs.session-token=x',
    '__Secure-authjs.session-token=x',
    '__Secure-authjs.session-token.0=x; __Secure-authjs.session-token.1=y',
  ])('lets %s through', (cookie) => {
    expect(proxy(request('/dashboard', cookie)).headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['', 'authjs.csrf-token=x', 'authjs.session-token-old=x'])(
    'sends a page to /login with cookie "%s"',
    (cookie) => {
      const res = proxy(request('/leads?page=2', cookie));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'https://app.test/login?callbackUrl=%2Fleads%3Fpage%3D2',
      );
    },
  );

  it('answers an API call with 401 instead of a redirect', () => {
    expect(proxy(request('/api/admin/leads')).status).toBe(401);
  });
});

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
