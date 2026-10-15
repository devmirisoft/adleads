import 'server-only';
import type { PaymentMethod } from '@/generated/prisma/client';
import { db, isUniqueViolation } from '@/lib/db';
import { formatMoney } from '@/modules/core/utils';
import { ensureRegistered, firstName, reclaimSeat } from '@/modules/enrollments';
import { transition, type Actor } from '@/modules/leads';
import { sendTemplate } from '@/modules/messaging';

export type MarkPaidInput = {
  paymentId: string;
  method: PaymentMethod;
  /** What was actually received. */
  amountPaise: number;
  razorpayPaymentId?: string;
  recordedById?: string;
  actor: Actor;
};

export type MarkPaidResult = 'enrolled' | 'duplicate' | 'needs_review';

/** Flag the lead for staff with a note saying why, instead of enrolling. */
async function needsReview(leadId: string, note: string): Promise<MarkPaidResult> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { notes: true } });
  await db.lead.update({
    where: { id: leadId },
    data: {
      needsHuman: true,
      notes: [lead.notes, `Payment check: ${note}`].filter(Boolean).join('\n'),
    },
  });
  return 'needs_review';
}

/**
 * THE single path to ENROLLED (Razorpay webhook and staff "Mark paid" both land here).
 * Idempotent on razorpayPaymentId / an already-PAID payment. Amount must equal the course fee.
 * A payment after the trial EXPIRED takes the seat back and gets a new Zoom link.
 */
export async function markPaid(input: MarkPaidInput): Promise<MarkPaidResult> {
  if (input.razorpayPaymentId) {
    const seen = await db.payment.findUnique({
      where: { razorpayPaymentId: input.razorpayPaymentId },
    });
    if (seen) return 'duplicate';
  }
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    include: {
      enrollment: { include: { lead: true, batch: { include: { course: true } } } },
    },
  });
  if (payment.status === 'PAID' || payment.status === 'REFUNDED') return 'duplicate';

  const e = payment.enrollment;
  const fee = e.batch.course.feePaise;
  const ref = input.razorpayPaymentId ? ` (${input.razorpayPaymentId})` : '';
  if (input.amountPaise !== fee) {
    return needsReview(
      e.leadId,
      `received ${formatMoney(input.amountPaise)}${ref} but the fee is ${formatMoney(fee)}. Not enrolled.`,
    );
  }
  if (e.status !== 'TRIAL' && e.status !== 'EXPIRED') {
    return needsReview(
      e.leadId,
      `received ${formatMoney(input.amountPaise)}${ref} for an enrollment that is ${e.status}. Not enrolled.`,
    );
  }

  const wasExpired = e.status === 'EXPIRED';
  // Zoom stays outside the transaction; it's idempotent, so a retry after a failure is safe.
  const joinUrl = await ensureRegistered(e.id);
  let overbooked = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          method: input.method,
          razorpayPaymentId: input.razorpayPaymentId,
          recordedById: input.recordedById,
        },
      });
      await tx.enrollment.update({
        where: { id: e.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (wasExpired) overbooked = await reclaimSeat(tx, e.batchId);
      await transition(
        e.leadId,
        'ENROLLED',
        { actor: input.actor, note: `Paid via ${input.method}` },
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate'; // same razorpayPaymentId raced in
    throw err;
  }
  if (overbooked) {
    await needsReview(
      e.leadId,
      `re-enrolled after expiry into ${e.batch.name}, which is now over capacity.`,
    );
  }

  try {
    await sendTemplate(
      e.leadId,
      'enrollment_confirmed',
      { name: firstName(e.lead), batch: e.batch.name, joinUrl },
      { sentBy: input.actor },
    );
  } catch (err) {
    // Enrollment stands; the FAILED message shows in the lead's thread for staff to follow up.
    console.error('[markPaid] confirmation not sent', err);
  }
  return 'enrolled';
}

/** Staff-recorded CASH / BANK / UPI_MANUAL payment → markPaid. */
export async function recordManualPayment(input: {
  enrollmentId: string;
  method: Exclude<PaymentMethod, 'RAZORPAY'>;
  amountPaise: number;
  recordedById: string;
}): Promise<MarkPaidResult> {
  const payment = await db.payment.create({
    data: {
      enrollmentId: input.enrollmentId,
      amountPaise: input.amountPaise,
      method: input.method,
      status: 'CREATED',
      recordedById: input.recordedById,
    },
  });
  return markPaid({
    paymentId: payment.id,
    method: input.method,
    amountPaise: input.amountPaise,
    recordedById: input.recordedById,
    actor: input.recordedById,
  });
}
