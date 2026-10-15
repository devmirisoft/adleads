import 'server-only';
import { db } from '@/lib/db';
import type { JobHandlers, JobType, RunResult } from '../types';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000; // 30 s, 1 min, 2 min, 4 min

type Claimed = { id: bigint; type: string; payload: unknown; attempts: number };

/**
 * Claim up to `limit` due jobs (SKIP LOCKED, so parallel runners never take the same job),
 * run them one by one, and retry failures with exponential backoff. After the last attempt
 * the job is FAILED and its lead (payload.leadId) is flagged for a human.
 */
// ponytail: a job left RUNNING by a crashed process is never reclaimed; add a "RUNNING for > 10 min → PENDING" sweep if that happens.
export async function runDue(handlers: JobHandlers, limit = 20): Promise<RunResult> {
  const jobs = await db.$queryRaw<Claimed[]>`
    UPDATE jobs SET status = 'RUNNING', attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'PENDING' AND run_at <= now()
      ORDER BY run_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts`;

  const result: RunResult = { done: 0, failed: [] };
  for (const job of jobs) {
    try {
      const handler = handlers[job.type as JobType];
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      await handler(job.payload);
      await db.job.update({ where: { id: job.id }, data: { status: 'DONE', lastError: null } });
      result.done++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const final = job.attempts >= MAX_ATTEMPTS || !(job.type in handlers);
      await db.job.update({
        where: { id: job.id },
        data: final
          ? { status: 'FAILED', lastError: error }
          : {
              status: 'PENDING',
              lastError: error,
              runAt: new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (job.attempts - 1)),
            },
      });
      if (final) await flagLead(job.payload);
      console.error(`[jobs] ${job.type} #${job.id} attempt ${job.attempts} failed: ${error}`);
      result.failed.push({ id: String(job.id), type: job.type, error });
    }
  }
  return result;
}

async function flagLead(payload: unknown) {
  const leadId = (payload as { leadId?: unknown } | null)?.leadId;
  if (typeof leadId === 'string') {
    await db.lead.updateMany({ where: { id: leadId }, data: { needsHuman: true } });
  }
}
