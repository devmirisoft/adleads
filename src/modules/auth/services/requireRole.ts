import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Role } from '@/modules/core/types';
import type { SessionUser } from '../types';

/**
 * The signed-in user, re-read from the DB once per request so deactivation and role
 * changes apply immediately (the JWT alone would keep them until it expires).
 * Not signed in or deactivated → /login.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      })
    : null;
  if (!user?.isActive) redirect('/login');
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/**
 * Same as requireUser, and the user's role must be one of `roles`; otherwise → /dashboard.
 * VIEWER is read-only · ADMIN + SALES act on leads, enrollments, payments · ADMIN manages the rest.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/dashboard');
  return user;
}
