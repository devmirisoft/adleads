import { NextResponse, type NextRequest } from 'next/server';

// Cookie present = let it through, with no decoding and no database, so this costs nothing per
// request. So a made-up cookie gets past this: every page, action and API route must call
// requireUser()/requireRole() from '@/modules/auth' itself. tests/lib/sessionGuard.test.ts enforces it.
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/; // .N: Auth.js splits big cookies

export function proxy(req: NextRequest) {
  // Every kind of request, signed in or not. dev/layout.tsx alone only covers plain page loads.
  if (process.env.NODE_ENV === 'production' && /^\/dev(\/|$)/.test(req.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  if (req.cookies.getAll().some((c) => SESSION_COOKIE.test(c.name))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const login = new URL('/login', req.nextUrl);
  login.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

// Public: /login, Auth.js endpoints, provider webhooks, cron (own secret), Next internals, files with an extension,
// and the marketing pages: exactly /, /privacy, /terms, /refund-policy, /contact (`.+` leaves out the bare "/").
// tests/lib/proxy.test.ts checks this list.
// TEMP: api/diag is exempt only while diagnosing the webhook; remove it with src/app/api/diag.
export const config = {
  matcher: [
    '/((?!login|api/auth|api/webhooks|api/cron|api/diag|_next/|.*\\..*|(?:privacy|terms|refund-policy|contact)$).+)',
  ],
};
