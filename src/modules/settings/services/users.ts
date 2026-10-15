import 'server-only';
import bcrypt from 'bcryptjs';
import type { Role } from '@/generated/prisma/enums';
import { db, isUniqueViolation } from '@/lib/db';
import { newUserSchema, type NewUser } from '../constants/keys';

export function listUsers() {
  return db.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}
export type UserListItem = Awaited<ReturnType<typeof listUsers>>[number];

/** Active ADMIN/SALES users — who leads can be assigned to. */
export function listStaff() {
  return db.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'SALES'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/** id → name for everyone (timelines show who did what, even if they've left). */
export async function userNames(): Promise<Record<string, string>> {
  const users = await db.user.findMany({ select: { id: true, name: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
}

export async function createUser(input: NewUser) {
  const u = newUserSchema.parse(input);
  try {
    return await db.user.create({
      data: {
        name: u.name,
        email: u.email.toLowerCase(),
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error('Someone already uses that email.');
    throw e;
  }
}

/** Never leave the app without an active admin, and never lock yourself out. */
async function guardAdmins(targetId: string, actorId: string, change: 'deactivate' | 'role') {
  if (targetId === actorId) {
    throw new Error(
      change === 'deactivate'
        ? "You can't deactivate yourself."
        : "You can't change your own role.",
    );
  }
  const target = await db.user.findUniqueOrThrow({ where: { id: targetId } });
  if (target.role === 'ADMIN' && target.isActive) {
    const admins = await db.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (admins <= 1)
      throw new Error('This is the last active admin. Make someone else an admin first.');
  }
}

export async function setUserActive(id: string, isActive: boolean, actorId: string) {
  if (!isActive) await guardAdmins(id, actorId, 'deactivate');
  await db.user.update({ where: { id }, data: { isActive } });
}

export async function setUserRole(id: string, role: Role, actorId: string) {
  await guardAdmins(id, actorId, 'role');
  await db.user.update({ where: { id }, data: { role } });
}
