import 'server-only';
import { db, type Tx } from '@/lib/db';
import { zoom } from '@/lib/zoom/client';
import { enqueue } from '@/modules/jobs';
import { canTransition, transition, type Actor } from '@/modules/leads';
import { freeSeat } from './assignSeat';
import { firstName } from './sendTrialLink';

/**
 * Unpaid trial is over: Zoom registrant cancelled first, then EXPIRED, seat freed, lead EXPIRED,
 * `trial_ended` sent, and the freed seat offered to the first waitlisted lead for that batch.
 * The lead must already be PAYMENT_PENDING (payments.expireDueTrials requests payment first).
 */
export async function expire(enrollmentId: string, { actor }: { actor: Actor }) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: true, batch: true },
  });
  if (e.status !== 'TRIAL') return; // already paid/expired/cancelled
  if (!canTransition(e.lead.status, 'EXPIRED')) {
    throw new Error(`Can't expire while the lead is ${e.lead.status}.`);
  }

  if (e.zoomRegistrantId && e.batch.zoomMeetingId) {
    await zoom.cancelRegistrant(e.batch.zoomMeetingId, e.zoomRegistrantId);
  }
  await db.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollmentId },
      // Link is dead; clearing it makes a late payment re-register (new link).
      data: { status: 'EXPIRED', zoomRegistrantId: null, zoomJoinUrl: null },
    });
    await freeSeat(tx, e.batchId);
    await transition(e.leadId, 'EXPIRED', { actor }, tx);
    await enqueue(
      'sendMessage',
      { leadId: e.leadId, template: 'trial_ended', vars: { name: firstName(e.lead) } },
      { tx },
    );
    await offerSeatToWaitlist(tx, e.batch);
  });
}

/**
 * Tell the longest-waiting WAITLISTED lead for this batch (or for its course, if they never got
 * to pick a batch) that a seat opened. Not reserved: their "Book my seat" reply runs assignSeat.
 */
async function offerSeatToWaitlist(tx: Tx, batch: { id: string; name: string; courseId: string }) {
  const lead = await tx.lead.findFirst({
    where: {
      status: 'WAITLISTED',
      optedOutAt: null,
      OR: [
        { answers: { some: { questionKey: 'batch', answerValue: batch.id } } },
        { courseId: batch.courseId, answers: { none: { questionKey: 'batch' } } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!lead) return;
  await tx.answer.upsert({
    where: { leadId_questionKey: { leadId: lead.id, questionKey: 'batch' } },
    create: {
      leadId: lead.id,
      questionKey: 'batch',
      answerValue: batch.id,
      answerLabel: batch.name,
    },
    update: { answerValue: batch.id, answerLabel: batch.name, answeredAt: new Date() },
  });
  await enqueue(
    'sendMessage',
    {
      leadId: lead.id,
      template: 'waitlist_seat_open',
      vars: { name: firstName(lead), batch: batch.name },
    },
    { tx },
  );
}
