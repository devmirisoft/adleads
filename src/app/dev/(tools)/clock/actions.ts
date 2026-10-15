'use server';

import { setDevNowOffsetDays } from '@/lib/clock';
import { requireUser } from '@/modules/auth';
import { runNudges } from '@/modules/bot';
import type { ApiResult } from '@/modules/core/types';
import { expireDueTrials, runTrialsCron } from '@/modules/payments';
import { runJobsNow } from '../../../_jobs/handlers';

export type CronName = 'jobs' | 'nudges' | 'trials' | 'expire';

const failures = (f: string[]) => (f.length ? ` · ${f.length} failed: ${f.join('; ')}` : '');

/** Same services the /api/cron/* routes call, then the job queue so queued messages go out now. */
export async function runCronNow(name: CronName): Promise<ApiResult<string>> {
  if (process.env.NODE_ENV === 'production') return { ok: false, error: 'Dev only.' };
  await requireUser();
  try {
    let summary: string;
    if (name === 'nudges') {
      const r = await runNudges();
      summary = `Nudged ${r.nudged}, dropped ${r.dropped}${failures(r.failed)}`;
    } else if (name === 'trials') {
      const r = await runTrialsCron();
      summary =
        `Class reminders ${r.classReminders} · payment links ${r.paymentRequests.done}` +
        `${failures(r.paymentRequests.failed)} · last-day reminders ${r.lastDayReminders.done}` +
        failures(r.lastDayReminders.failed);
    } else if (name === 'expire') {
      const r = await expireDueTrials();
      summary = `Expired ${r.done}${failures(r.failed)}`;
    } else {
      summary = '';
    }
    const jobs = await runJobsNow();
    summary += `${summary ? ' · ' : ''}jobs done ${jobs.done}${failures(jobs.failed.map((f) => `${f.type}: ${f.error}`))}`;
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Cron run failed.' };
  }
}

export async function shiftClock(days: number): Promise<ApiResult<number>> {
  if (process.env.NODE_ENV === 'production') return { ok: false, error: 'Dev only.' };
  await requireUser();
  if (!Number.isInteger(days) || days < 0 || days > 60) {
    return { ok: false, error: 'Enter a whole number of days from 0 to 60.' };
  }
  await setDevNowOffsetDays(days);
  return { ok: true, data: days };
}
