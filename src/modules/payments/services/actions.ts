'use server';
import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { CAN_ACT, guarded } from '@/modules/auth';
import { manualPaymentSchema, type ManualPaymentInput } from '../types';
import { recordManualPayment, type MarkPaidResult } from './markPaid';
import { refundPayment } from './refund';
import { requestPayment } from './requestPayment';

const id = z.uuid();

const explain = (r: MarkPaidResult) => {
  if (r === 'duplicate') throw new Error('This payment was already recorded.');
  if (r === 'needs_review') {
    throw new Error(
      "Not enrolled: the amount doesn't match the fee or the enrollment can't take a payment. The lead is flagged with a note.",
    );
  }
  return r;
};

/** Create (or reuse) the Razorpay link and send `trial_payment_reminder`. */
export async function requestPaymentAction(enrollmentId: string) {
  return guarded(CAN_ACT, async (user) => {
    const p = await requestPayment(id.parse(enrollmentId), { actor: user.id });
    return p.razorpayLinkUrl;
  });
}

/** Re-send an open link (a new one if it has expired). */
export async function resendPaymentLinkAction(paymentId: string) {
  return guarded(CAN_ACT, async (user) => {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: id.parse(paymentId) } });
    const p = await requestPayment(payment.enrollmentId, { actor: user.id });
    return p.razorpayLinkUrl;
  });
}

export async function recordManualPaymentAction(input: ManualPaymentInput) {
  return guarded(CAN_ACT, async (user) => {
    const v = manualPaymentSchema.parse(input);
    return explain(
      await recordManualPayment({
        enrollmentId: v.enrollmentId,
        method: v.method,
        amountPaise: Math.round(v.rupees * 100),
        recordedById: user.id,
      }),
    );
  });
}

/** Staff records a refund made outside the app; cancels the enrollment. */
export async function markRefundedAction(paymentId: string) {
  return guarded(CAN_ACT, async (user) => {
    await refundPayment(id.parse(paymentId), 'Refunded (recorded by staff)', { actor: user.id });
    return null;
  });
}
