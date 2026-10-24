import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Optimistic check only (valid session cookie). Pages, actions and API routes still
// call requireUser()/requireRole() from '@/modules/auth' for the real authorization.
export const proxy = auth((req) => {
  if (req.auth) return;
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const login = new URL('/login', req.nextUrl);
  login.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
});

// Public: /login, Auth.js endpoints, provider webhooks, cron (own secret), Next internals, files with an extension,
// and the marketing pages: exactly /, /privacy, /terms, /refund-policy, /contact (`.+` leaves out the bare "/").
// tests/lib/proxy.test.ts checks this list.
export const config = {
  matcher: [
    '/((?!login|api/auth|api/webhooks|api/cron|_next/|.*\\..*|(?:privacy|terms|refund-policy|contact)$).+)',
  ],
};
