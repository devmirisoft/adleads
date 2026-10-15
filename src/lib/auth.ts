import 'server-only';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: config.NEXTAUTH_SECRET,
  trustHost: true, // self-hosted behind our own reverse proxy
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok || !user.isActive) return null;
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
