import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from '@/proxy';

// For plain paths Next compiles the matcher to this same anchored regex (plus optional .rsc/.json suffixes).
const runsOn = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

const request = (path: string, cookie = '') =>
  new NextRequest(`https://app.test${path}`, { headers: { cookie } });

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

describe('dev tools in production', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['/dev/ui', ''],
    ['/dev', ''],
    ['/dev/clock', 'authjs.session-token=x'],
    ['/dev/pay/abc', 'authjs.session-token=x'],
  ])('%s is 404, cookie "%s"', (path, cookie) => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(proxy(request(path, cookie)).status).toBe(404);
  });

  it('leaves other paths alone, and dev tools work outside production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(proxy(request('/developers', 'authjs.session-token=x')).status).not.toBe(404);
    vi.stubEnv('NODE_ENV', 'development');
    expect(proxy(request('/dev/ui', 'authjs.session-token=x')).status).not.toBe(404);
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
    '/api/realtime/auth',
    '/dev/ui',
    '/contacts',
    '/terms-old',
    '/privacy/x',
  ])('guards %s', (path) => {
    expect(runsOn(path)).toBe(true);
  });
});
