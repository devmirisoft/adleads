import 'server-only';
import bcrypt from 'bcryptjs';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { Role } from '@/generated/prisma/enums';
import { config } from './config';
import { db } from './db';

declare module 'next-auth' {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; name: string; email: string; role: Role };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}

const credentials = z.object({ email: z.email(), password: z.string().min(1) });
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const MAX_FAILED_LOGINS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

/** Thrown by authorize() once an IP is throttled; the login action shows a "wait" message for it. */
export class TooManyLoginAttempts extends CredentialsSignin {
  code = 'rate_limited';
}

// ponytail: trusts the first X-Forwarded-For hop (Vercel overwrites it). Behind our own reverse
// proxy, make it overwrite the header too, or clients can rotate it to dodge the throttle.
const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

export async function isLoginThrottled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failures = await db.loginAttempt.count({ where: { ip, createdAt: { gte: since } } });
  return failures >= MAX_FAILED_LOGINS;
}

export async function recordFailedLogin(ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  await db.$transaction([
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: since } } }),
    db.loginAttempt.create({ data: { ip } }),
  ]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: config.NEXTAUTH_SECRET,
  trustHost: true, // self-hosted behind our own reverse proxy
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Every credentials sign-in lands here (login action or a direct POST to /api/auth), so the throttle lives here too.
      async authorize(raw, request) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const ip = clientIp(request);
        if (await isLoginThrottled(ip)) throw new TooManyLoginAttempts();
        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok || !user.isActive) {
          await recordFailedLogin(ip);
          return null;
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});

export const { GET, POST } = handlers;
