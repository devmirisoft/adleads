import 'server-only';
import { db } from '@/lib/db';
import { publishInboxChanged } from '@/lib/realtime/client';
import type { JobHandlers, JobType, RunResult } from '../types';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000; // 30 s, 1 min, 2 min, 4 min

type Claimed = { id: bigint; type: string; payload: unknown; attempts: number };

/**
 * A job RUNNING for over 5 minutes lost its process (serverless kill, crash): back to PENDING, or
 * FAILED + lead flagged once its attempts are used up. Claiming already counted the attempt.
 * The dead process may have got partway, so every handler must be safe to run twice.
 */
async function sweepStuck() {
  const stuck = await db.$queryRaw<(Omit<Claimed, 'attempts'> & { status: string })[]>`
    UPDATE jobs
    SET status = (CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'FAILED' ELSE 'PENDING' END)::"JobStatus",
        last_error = 'Runner stopped mid-job (RUNNING for over 5 minutes)',
        updated_at = now()
    WHERE status = 'RUNNING' AND updated_at < now() - interval '5 minutes'
    RETURNING id, type, payload, status::text AS status`;
  for (const job of stuck) {
    console.error(`[jobs] ${job.type} #${job.id} was stuck RUNNING, now ${job.status}`);
    if (job.status === 'FAILED') await flagLead(job.payload);
  }
}

/**
 * Run up to `limit` due jobs, claiming one at a time (SKIP LOCKED, so parallel runners never take
 * the same job). One at a time so a killed process strands only the job in flight, and a slow
 * batch can't look stuck to the sweep. Failures retry with exponential backoff. After the last
 * attempt the job is FAILED and its lead (payload.leadId) is flagged for a human.
 */
export async function runDue(handlers: JobHandlers, limit = 20): Promise<RunResult> {
  await sweepStuck();

  const result: RunResult = { done: 0, failed: [] };
  for (let i = 0; i < limit; i++) {
    const [job] = await db.$queryRaw<Claimed[]>`
      UPDATE jobs SET status = 'RUNNING', attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM jobs
        WHERE status = 'PENDING' AND run_at <= now()
        ORDER BY run_at, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, type, payload, attempts`;
    if (!job) break;

    try {
      const handler = handlers[job.type as JobType];
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      const note = await handler(job.payload);
      await db.job.update({
        where: { id: job.id },
        data: { status: 'DONE', lastError: note || null },
      });
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
    await publishInboxChanged();
  }
}
