import 'server-only';
import type { BatchStatus } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { addTrialDays, istDate } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { transition, type Actor } from '@/modules/leads';
import { getSetting } from '@/modules/settings';

// Everything that changes batches.seats_taken lives in this file, always under a row lock.

type LockedBatch = {
  id: string;
  course_id: string;
  capacity: number;
  seats_taken: number;
  status: BatchStatus;
};

async function lockBatch(tx: Tx, batchId: string): Promise<LockedBatch> {
  const [batch] = await tx.$queryRaw<LockedBatch[]>`
    SELECT id, course_id, capacity, seats_taken, status FROM batches
    WHERE id = ${batchId}::uuid FOR UPDATE`;
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  return batch;
}

const hasFreeSeat = (b: LockedBatch) => b.status !== 'CLOSED' && b.seats_taken < b.capacity;

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
 * enrollment, take the seat, lead → TRIAL_ACTIVE, queue Zoom registration — one transaction.
 * No seat → lead WAITLISTED.
 */
export async function assignSeat(
  leadId: string,
  batchId: string,
  { actor }: { actor: Actor },
): Promise<AssignResult> {
  const today = istDate(await now());
  return db.$transaction(async (tx) => {
    const batch = await lockBatch(tx, batchId);
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { status: true },
    });

    if (!hasFreeSeat(batch)) {
      if (lead.status !== 'WAITLISTED') {
        await transition(leadId, 'WAITLISTED', { actor, note: 'Batch full' }, tx);
      }
      return { result: 'waitlisted' };
    }

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
        zoomRegistrantId: null,
        zoomJoinUrl: null,
        linkSentAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
    });
    await takeSeat(tx, batch);
    await tx.lead.update({ where: { id: leadId }, data: { courseId: batch.course_id } });
    await transition(leadId, 'TRIAL_ACTIVE', { actor }, tx);
    await enqueue('zoomRegister', { enrollmentId: enrollment.id, leadId }, { tx });
    return { result: 'trial', enrollmentId: enrollment.id };
  });
}

/**
 * Move a live (TRIAL/PAID) enrollment to another batch: take the new seat, free the old one,
 * queue cancelling the old Zoom registrant and registering on the new meeting.
 */
export async function moveBatch(enrollmentId: string, newBatchId: string) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { batch: { select: { zoomMeetingId: true } } },
  });
  if (e.status !== 'TRIAL' && e.status !== 'PAID') {
    throw new Error('Only trial or paid enrollments can change batch.');
  }
  if (e.batchId === newBatchId) return;

  await db.$transaction(async (tx) => {
    // Lock in a fixed order so two opposite moves can't deadlock.
    const [a, b] = [e.batchId, newBatchId].sort();
    const locked = new Map([
      [a, await lockBatch(tx, a)],
      [b, await lockBatch(tx, b)],
    ]);
    const target = locked.get(newBatchId)!;
    if (!hasFreeSeat(target)) throw new Error('That batch has no free seats.');
    await takeSeat(tx, target);
    await releaseSeat(tx, locked.get(e.batchId)!);
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { batchId: newBatchId, zoomRegistrantId: null, zoomJoinUrl: null, linkSentAt: null },
    });
    if (e.zoomRegistrantId && e.batch.zoomMeetingId) {
      await enqueue(
        'zoomCancel',
        {
          meetingId: String(e.batch.zoomMeetingId),
          registrantId: e.zoomRegistrantId,
          leadId: e.leadId,
        },
        { tx },
      );
    }
    await enqueue('zoomRegister', { enrollmentId, leadId: e.leadId }, { tx });
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
