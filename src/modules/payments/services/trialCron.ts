import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { addDays, istDate } from '@/modules/core/utils';
import { expire, firstName, sendClassReminders } from '@/modules/enrollments';
import { sendTemplate } from '@/modules/messaging';
import { getSetting } from '@/modules/settings';
import { requestPayment } from './requestPayment';

export type CronResult = { done: number; failed: string[] };

async function each<T extends { id: string }>(items: T[], run: (item: T) => Promise<unknown>) {
  const result: CronResult = { done: 0, failed: [] };
  for (const item of items) {
    try {
      await run(item);
      result.done++;
    } catch (e) {
      result.failed.push(`${item.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

/**
 * Daily 09:00 IST: class reminders (first class tomorrow), payment link at trialEnd − N days
 * (or later, for short/extended trials), and the last-day reminder.
 */
export async function runTrialsCron() {
  const today = istDate(await now());
  const daysBefore = await getSetting('reminder_days_before');

  const classReminders = await sendClassReminders();

  const due = await db.enrollment.findMany({
    where: {
      status: 'TRIAL',
      trialEnd: { lte: addDays(today, daysBefore) },
      lead: { status: 'TRIAL_ACTIVE', optedOutAt: null },
    },
  });
  const paymentRequests = await each(due, (e) => requestPayment(e.id, { actor: 'cron' }));

  const lastDay = await db.enrollment.findMany({
    where: {
      status: 'TRIAL',
      trialEnd: today,
      lead: { status: 'PAYMENT_PENDING', optedOutAt: null },
    },
    include: {
      lead: true,
      payments: {
        where: { status: 'CREATED', method: 'RAZORPAY' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  const lastDayReminders = await each(
    lastDay.filter((e) => e.payments[0]?.razorpayLinkUrl),
    (e) =>
      sendTemplate(
        e.leadId,
        'trial_last_day',
        { name: firstName(e.lead), payUrl: e.payments[0].razorpayLinkUrl! },
        { sentBy: 'cron' },
      ),
  );
  return { classReminders, paymentRequests, lastDayReminders };
}

/**
 * Daily 23:30 IST: expire trials whose last day is today or earlier and still unpaid.
 * A lead that never got a payment link gets one first (PAYMENT_PENDING is the only way to EXPIRED),
 * so they can still pay to re-enroll.
 */
export async function expireDueTrials(): Promise<CronResult> {
  const today = istDate(await now());
  const due = await db.enrollment.findMany({
    where: { status: 'TRIAL', trialEnd: { lte: today } },
    include: { lead: { select: { status: true } } },
  });
  return each(due, async (e) => {
    if (e.lead.status === 'TRIAL_ACTIVE') await requestPayment(e.id, { actor: 'cron' });
    await expire(e.id, { actor: 'cron' });
  });
}
