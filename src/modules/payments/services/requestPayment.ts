import 'server-only';
import { randomUUID } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { razorpay } from '@/lib/razorpay/client';
import { formatDate, formatMoney } from '@/modules/core/utils';
import { firstName } from '@/modules/enrollments';
import { transition, type Actor } from '@/modules/leads';
import { sendTemplate } from '@/modules/messaging';
import { getSetting } from '@/modules/settings';

/**
 * Create (or reuse an unexpired) Razorpay link for the course fee, move the lead to
 * PAYMENT_PENDING, and send `trial_payment_reminder`. Safe to retry.
 */
export async function requestPayment(enrollmentId: string, { actor }: { actor: Actor }) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: true, batch: { include: { course: true } } },
  });
  if (e.status !== 'TRIAL' && e.status !== 'EXPIRED') {
    throw new Error('A payment link can only be sent for a trial or an expired trial.');
  }
  const at = await now();
  const fee = e.batch.course.feePaise;

  let payment = await db.payment.findFirst({
    where: { enrollmentId, method: 'RAZORPAY', status: 'CREATED', linkExpiresAt: { gt: at } },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment) {
    const hours = await getSetting('payment_link_expiry_hours');
    const expireBy = new Date(at.getTime() + hours * 3_600_000);
    const id = randomUUID();
    const link = await razorpay.createPaymentLink({
      amountPaise: fee,
      referenceId: id,
      customer: { name: e.lead.name ?? e.lead.profileName ?? 'Student', contact: e.lead.phoneE164 },
      expireBy,
    });
    payment = await db.payment.create({
      data: {
        id,
        enrollmentId,
        amountPaise: fee,
        method: 'RAZORPAY',
        status: 'CREATED',
        razorpayLinkId: link.id,
        razorpayLinkUrl: link.shortUrl,
        linkExpiresAt: expireBy,
      },
    });
  }

  if (e.lead.status === 'TRIAL_ACTIVE') {
    await transition(e.leadId, 'PAYMENT_PENDING', { actor });
  }
  await sendTemplate(
    e.leadId,
    'trial_payment_reminder',
    {
      name: firstName(e.lead),
      course: e.batch.course.name,
      trialEnd: formatDate(e.trialEnd),
      amount: formatMoney(fee),
      payUrl: payment.razorpayLinkUrl!,
    },
    { sentBy: actor },
  );
  return payment;
}
