import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { addDays, formatDate, formatTime, istDate, isoWeekday } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { firstName } from './sendTrialLink';

export async function extendTrial(enrollmentId: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Extend by 1–30 days.');
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  if (e.status !== 'TRIAL') throw new Error('Only active trials can be extended.');
  return db.enrollment.update({
    where: { id: enrollmentId },
    data: { trialEnd: addDays(e.trialEnd, days) },
  });
}

/** First date on/after `from` that falls on one of the batch's weekdays. */
function firstClassOnOrAfter(from: Date, daysOfWeek: number[]): Date | null {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (daysOfWeek.includes(isoWeekday(d))) return d;
  }
  return null;
}

/** Daily cron: `class_reminder` to trial students whose first class is tomorrow. Returns how many were queued. */
export async function sendClassReminders(): Promise<number> {
  const tomorrow = addDays(istDate(await now()), 1);
  const trials = await db.enrollment.findMany({
    where: {
      status: 'TRIAL',
      zoomJoinUrl: { not: null },
      trialStart: { lte: tomorrow },
      lead: { optedOutAt: null },
    },
    include: { lead: true, batch: true },
  });
  let queued = 0;
  for (const e of trials) {
    const from = e.trialStart > e.batch.startDate ? e.trialStart : e.batch.startDate;
    const first = firstClassOnOrAfter(from, e.batch.daysOfWeek);
    if (first?.getTime() !== tomorrow.getTime()) continue;
    await enqueue('sendMessage', {
      leadId: e.leadId,
      template: 'class_reminder',
      vars: {
        name: firstName(e.lead),
        batch: e.batch.name,
        when: `tomorrow (${formatDate(first)}) at ${formatTime(e.batch.startTime)} IST`,
        joinUrl: e.zoomJoinUrl!,
      },
    });
    queued++;
  }
  return queued;
}
