import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { refundPayment } from './refund';
import { markPaid } from './markPaid';

const entity = <T extends z.ZodRawShape>(shape: T) => z.object({ entity: z.object(shape) });

const razorpayEvent = z.object({
  event: z.string(),
  payload: z.object({
    payment_link: entity({ id: z.string() }).optional(),
    payment: entity({ id: z.string(), amount: z.number().int() }).optional(),
    refund: entity({ id: z.string(), payment_id: z.string() }).optional(),
  }),
});

/** processWebhook job for provider RAZORPAY. Events we don't use are ignored. */
export async function handleRazorpayEvent(payload: unknown): Promise<void> {
  const { event, payload: p } = razorpayEvent.parse(payload);

  switch (event) {
    case 'payment_link.paid': {
      if (!p.payment_link || !p.payment) throw new Error('payment_link.paid without link/payment');
      const payment = await db.payment.findFirst({
        where: { razorpayLinkId: p.payment_link.entity.id },
      });
      if (!payment) throw new Error(`No payment for link ${p.payment_link.entity.id}`);
      await markPaid({
        paymentId: payment.id,
        method: 'RAZORPAY',
        amountPaise: p.payment.entity.amount,
        razorpayPaymentId: p.payment.entity.id,
        actor: 'webhook',
      });
      return;
    }
    case 'payment_link.expired': {
      if (!p.payment_link) return;
      await db.payment.updateMany({
        where: { razorpayLinkId: p.payment_link.entity.id, status: 'CREATED' },
        data: { status: 'EXPIRED' },
      });
      return;
    }
    case 'refund.processed': {
      if (!p.refund) return;
      const payment = await db.payment.findUnique({
        where: { razorpayPaymentId: p.refund.entity.payment_id },
      });
      if (payment) await refundPayment(payment.id, 'Refunded via Razorpay', { actor: 'webhook' });
      return;
    }
    default:
      // e.g. payment.failed: the link stays open for another attempt; nothing to change.
      return;
  }
}
