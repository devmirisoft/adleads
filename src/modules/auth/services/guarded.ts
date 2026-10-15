import 'server-only';
import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import type { ApiResult, Role } from '@/modules/core/types';
import type { SessionUser } from '../types';
import { requireRole } from './requireRole';

/** Who may do what. VIEWER is read-only everywhere. */
export const CAN_ACT: Role[] = ['ADMIN', 'SALES']; // leads, enrollments, payments
export const ADMIN_ONLY: Role[] = ['ADMIN']; // courses, batches, bot script, settings, users

const GENERIC = 'Something went wrong. Try again, and tell an admin if it keeps happening.';

/** Turn any thrown error into a sentence staff can act on. Our services throw readable messages. */
function staffMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? 'Check the form and try again.';
  if (e instanceof Error && !e.name.startsWith('PrismaClient')) return e.message;
  return GENERIC;
}

/**
 * Body of every server action: role check → run → refresh the page → `{ ok, data } | { ok, error }`.
 * The role check redirects (not signed in / wrong role), so the UI only toasts real failures.
 */
export async function guarded<T>(
  roles: Role[],
  run: (user: SessionUser) => Promise<T>,
): Promise<ApiResult<T>> {
  const user = await requireRole(...roles);
  try {
    const data = await run(user);
    refresh();
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e); // let Next's redirect/notFound through
    console.error('[action]', e);
    return { ok: false, error: staffMessage(e) };
  }
}
