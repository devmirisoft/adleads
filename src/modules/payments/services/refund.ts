import 'server-only';
import { db } from '@/lib/db';
import { cancel } from '@/modules/enrollments';
import type { Actor } from '@/modules/leads';

/**
 * Record a refund (Razorpay webhook or staff "Mark refunded"): payment REFUNDED, then the
 * enrollment is cancelled (Zoom link stops, seat freed, lead CANCELLED). Idempotent.
 */
export async function refundPayment(
  paymentId: string,
  reason: string,
  { actor }: { actor: Actor },
) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status === 'REFUNDED') return;
  if (payment.status !== 'PAID') throw new Error('Only a paid payment can be refunded.');
  await db.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
  await cancel(payment.enrollmentId, reason, { actor });
}
