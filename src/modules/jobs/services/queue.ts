import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import type { JobType } from '../types';

/** Queue a job (runs on the next /api/cron/jobs tick at or after `runAt`). Pass `tx` to commit with the caller. */
export async function enqueue(
  type: JobType,
  payload: Prisma.InputJsonObject,
  { runAt, tx = db }: { runAt?: Date; tx?: Tx } = {},
) {
  return tx.job.create({ data: { type, payload, ...(runAt && { runAt }) } });
}
