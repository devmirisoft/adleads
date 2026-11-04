import 'server-only';
import { db } from '@/lib/db';
import { canTransition, transition, type Actor } from '@/modules/leads';
import { freeSeat } from './assignSeat';

/** Cancel an enrollment (staff action or refund): CANCELLED + seat freed + lead CANCELLED. */
export async function cancel(enrollmentId: string, reason: string, { actor }: { actor: Actor }) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: { select: { status: true } } },
  });
  if (e.status === 'CANCELLED') return;
  const leadCancels = e.lead.status !== 'CANCELLED';
  if (leadCancels && !canTransition(e.lead.status, 'CANCELLED')) {
    throw new Error(`Can't cancel while the lead is ${e.lead.status}.`);
  }

  await db.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });
    if (e.status === 'TRIAL' || e.status === 'PAID') await freeSeat(tx, e.batchId);
    if (leadCancels) await transition(e.leadId, 'CANCELLED', { actor, note: reason }, tx);
  });
}
