import 'server-only';
import { db } from '@/lib/db';
import { enqueue } from '@/modules/jobs';
import { canTransition, transition, type Actor } from '@/modules/leads';
import { freeSeat } from './assignSeat';
import { firstName } from './sendTrialLink';

/**
 * Unpaid trial is over: EXPIRED, seat freed, lead EXPIRED, `trial_ended` sent. The next
 * runWaitlistOffers offers the freed seat.
 */
export async function expire(enrollmentId: string, { actor }: { actor: Actor }) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: true },
  });
  if (e.status !== 'TRIAL') return; // already paid/expired/cancelled
  if (!canTransition(e.lead.status, 'EXPIRED')) {
    throw new Error(`Can't expire while the lead is ${e.lead.status}.`);
  }

  await db.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollmentId },
      // Their trial is over: clearing it stops the bot resending it, and reminders going out.
      data: { status: 'EXPIRED', zoomJoinUrl: null },
    });
    await freeSeat(tx, e.batchId);
    await transition(e.leadId, 'EXPIRED', { actor }, tx);
    await enqueue(
      'sendMessage',
      { leadId: e.leadId, template: 'trial_ended', vars: { name: firstName(e.lead) } },
      { tx },
    );
  });
}
