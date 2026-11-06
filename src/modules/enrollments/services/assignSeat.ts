import 'server-only';
import type { BatchStatus, Prisma } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { addTrialDays, istDate } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { transition, type Actor } from '@/modules/leads';
import { getSetting } from '@/modules/settings';

// Everything that changes batches.seats_taken lives in this file, always under a row lock.

export type LockedBatch = {
  id: string;
  course_id: string;
  name: string;
  capacity: number;
  seats_taken: number;
  status: BatchStatus;
  end_date: Date;
  trial_link: string | null;
  waitlist_alerted_at: Date | null;
};

export async function lockBatch(tx: Tx, batchId: string): Promise<LockedBatch> {
  const [batch] = await tx.$queryRaw<LockedBatch[]>`
    SELECT id, course_id, name, capacity, seats_taken, status, end_date, trial_link, waitlist_alerted_at
    FROM batches WHERE id = ${batchId}::uuid FOR UPDATE`;
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  return batch;
}

/** A lead the waitlist can still reach. */
export const WAITING = { status: 'WAITLISTED', optedOutAt: null } satisfies Prisma.LeadWhereInput;

/** An offer holding a seat right now. A lapsed one stops counting at once, before the cron marks it. */
export const outstandingOffer = (at: Date) =>
  ({
    status: 'PENDING',
    expiresAt: { gt: at },
    lead: WAITING,
  }) satisfies Prisma.WaitlistOfferWhereInput;

export const heldSeats = (tx: Tx, batchId: string, at: Date) =>
  tx.waitlistOffer.count({ where: { batchId, ...outstandingOffer(at) } });

/** Not closed and not over. */
export const isLive = (b: LockedBatch, today: Date) =>
  b.status !== 'CLOSED' && b.end_date.getTime() >= today.getTime();

const hasFreeSeat = (b: LockedBatch, today: Date, held: number) =>
  isLive(b, today) && b.seats_taken + held < b.capacity;

/** OPEN ↔ FULL follows the count; CLOSED stays CLOSED. */
const statusFor = (b: LockedBatch, taken: number): BatchStatus =>
  b.status === 'CLOSED' ? 'CLOSED' : taken >= b.capacity ? 'FULL' : 'OPEN';

async function takeSeat(tx: Tx, b: LockedBatch) {
  const taken = b.seats_taken + 1;
  await tx.batch.update({
    where: { id: b.id },
    data: { seatsTaken: taken, status: statusFor(b, taken) },
  });
}

async function releaseSeat(tx: Tx, b: LockedBatch) {
  const taken = Math.max(0, b.seats_taken - 1);
  await tx.batch.update({
    where: { id: b.id },
    data: { seatsTaken: taken, status: statusFor(b, taken) },
  });
}

/** Free the seat an enrollment held (expire / cancel). Call inside the caller's transaction. */
export async function freeSeat(tx: Tx, batchId: string) {
  await releaseSeat(tx, await lockBatch(tx, batchId));
}

export type AssignResult = { result: 'trial'; enrollmentId: string } | { result: 'waitlisted' };

/**
 * Give a QUALIFIED/WAITLISTED lead a trial seat: lock the batch, check capacity, create the TRIAL
 * enrollment, take the seat, lead → TRIAL_ACTIVE, queue the trial link — one transaction.
 * Seats held by other leads' open offers aren't free. Closed, ended or no seat → lead WAITLISTED.
 */
export async function assignSeat(
  leadId: string,
  batchId: string,
  { actor }: { actor: Actor },
): Promise<AssignResult> {
  const at = await now();
  const today = istDate(at);
  return db.$transaction(async (tx) => {
    const batch = await lockBatch(tx, batchId);
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { status: true },
    });
    const myOffer = await tx.waitlistOffer.findFirst({
      where: { leadId, batchId, ...outstandingOffer(at) },
    });

    // An offer is honoured even if capacity was cut below the seats on offer: first to book wins.
    const held = myOffer ? 0 : await heldSeats(tx, batchId, at);
    if (!hasFreeSeat(batch, today, held)) {
      if (lead.status !== 'WAITLISTED') {
        await transition(leadId, 'WAITLISTED', { actor, note: 'No seat available' }, tx);
      }
      return { result: 'waitlisted' };
    }

    if (myOffer) {
      await tx.waitlistOffer.update({
        where: { id: myOffer.id },
        data: { status: 'ACCEPTED', resolvedAt: at },
      });
    }
    await tx.waitlistOffer.updateMany({
      where: { leadId, status: 'PENDING' },
      data: { status: 'CANCELLED', resolvedAt: at },
    });

    const course = await tx.course.findUniqueOrThrow({ where: { id: batch.course_id } });
    const trialDays = course.trialDays ?? (await getSetting('default_trial_days', tx));
    const trial = {
      status: 'TRIAL' as const,
      trialStart: today,
      trialEnd: addTrialDays(today, trialDays),
    };
    const enrollment = await tx.enrollment.upsert({
      where: { leadId_batchId: { leadId, batchId } },
      create: { leadId, batchId, ...trial },
      // Same lead back in the same batch (e.g. after a waitlist): start a fresh trial.
      update: {
        ...trial,
        zoomJoinUrl: null,
        linkSentAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
    });
    await takeSeat(tx, batch);
    await tx.lead.update({
      where: { id: leadId },
      data: {
        courseId: batch.course_id,
        ...(lead.status === 'WAITLISTED' && { needsHuman: false }),
      },
    });
    await transition(leadId, 'TRIAL_ACTIVE', { actor }, tx);
    await enqueue('sendTrialLink', { enrollmentId: enrollment.id, leadId }, { tx });
    return { result: 'trial', enrollmentId: enrollment.id };
  });
}

/**
 * Move a live (TRIAL/PAID) enrollment to another batch: take the new seat, free the old one,
 * queue the new batch's link for their stage.
 */
export async function moveBatch(enrollmentId: string, newBatchId: string) {
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  if (e.status !== 'TRIAL' && e.status !== 'PAID') {
    throw new Error('Only trial or paid enrollments can change batch.');
  }
  if (e.batchId === newBatchId) return;
  const at = await now();

  await db.$transaction(async (tx) => {
    // Lock in a fixed order so two opposite moves can't deadlock.
    const [a, b] = [e.batchId, newBatchId].sort();
    const locked = new Map([
      [a, await lockBatch(tx, a)],
      [b, await lockBatch(tx, b)],
    ]);
    const target = locked.get(newBatchId)!;
    if (!hasFreeSeat(target, istDate(at), await heldSeats(tx, newBatchId, at))) {
      throw new Error('That batch has no free seats, or has closed or ended.');
    }
    await takeSeat(tx, target);
    await releaseSeat(tx, locked.get(e.batchId)!);
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { batchId: newBatchId, zoomJoinUrl: null, linkSentAt: null },
    });
    await enqueue('sendTrialLink', { enrollmentId, leadId: e.leadId }, { tx });
  });
}

/**
 * Paid after the trial EXPIRED: take the seat back, even past capacity — they've paid.
 * Returns true if that over-filled the batch (caller flags it for staff). Use inside markPaid's transaction.
 */
export async function reclaimSeat(tx: Tx, batchId: string): Promise<boolean> {
  const batch = await lockBatch(tx, batchId);
  await takeSeat(tx, batch);
  return batch.seats_taken + 1 > batch.capacity;
}
