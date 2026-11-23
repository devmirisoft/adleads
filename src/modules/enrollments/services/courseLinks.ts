import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { istDate, istHour } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { firstName } from './sendTrialLink';

const DAY = 86_400_000;
/** No course links before this hour (IST), so nobody gets one at midnight. */
const LINKS_FROM_HOUR = 8;

/**
 * Which link (0-based) is due on `day` (trial start = day 1): link k goes out on day 1 + k × interval.
 * null when nothing is due that day or the links have run out.
 */
export function linkIndexForDay(day: number, count: number, interval: number): number | null {
  if (day < 1 || (day - 1) % interval !== 0) return null;
  const k = (day - 1) / interval;
  return k < count ? k : null;
}

/**
 * Every 30 min (nudges cron): queue today's course link for each live enrollment, each on its own
 * schedule from its trial start. `lastLinkDay` makes a re-run (or an overlapping run) queue nothing.
 * Returns the TRIAL enrollments that just got their final link: they're due a payment reminder.
 */
// ponytail: a day the cron never runs skips that day's link; catch up from lastLinkDay if that's ever seen.
// Loads every live enrollment with links each run; page it if that ever reaches the thousands.
export async function sendCourseLinks(): Promise<{ queued: number; finishedTrials: string[] }> {
  const at = await now();
  const finishedTrials: string[] = [];
  if (istHour(at) < LINKS_FROM_HOUR) {
    return { queued: 0, finishedTrials };
  }
  const today = istDate(at);
  const live = await db.enrollment.findMany({
    where: {
      status: { in: ['TRIAL', 'PAID'] },
      lead: { optedOutAt: null },
      batch: { course: { links: { isEmpty: false } } },
    },
    include: { lead: true, batch: { include: { course: true } } },
  });

  let queued = 0;
  for (const e of live) {
    const { links, linkIntervalDays, name: course } = e.batch.course;
    const day = Math.round((today.getTime() - e.trialStart.getTime()) / DAY) + 1;
    const k = linkIndexForDay(day, links.length, linkIntervalDays);
    if (k === null || e.lastLinkDay >= day) continue;

    const claimed = await db.$transaction(async (tx) => {
      const { count } = await tx.enrollment.updateMany({
        where: { id: e.id, lastLinkDay: { lt: day } },
        data: { lastLinkDay: day },
      });
      if (count === 0) return false; // another run got here first
      await enqueue(
        'sendMessage',
        {
          leadId: e.leadId,
          template: 'course_link',
          vars: { name: firstName(e.lead), course, number: String(k + 1), link: links[k] },
        },
        { tx },
      );
      return true;
    });
    if (!claimed) continue;
    queued++;
    if (e.status === 'TRIAL' && k === links.length - 1) finishedTrials.push(e.id);
  }
  return { queued, finishedTrials };
}
