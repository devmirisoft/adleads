'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { config } from '@/lib/config';
import { signRazorpayBody } from '@/lib/razorpay/verify';
import { requireUser } from '@/modules/auth';
import type { ApiResult } from '@/modules/core/types';
import { getPaymentByLinkId } from '@/modules/payments';
import { runJobsNow } from '../../../../_jobs/handlers';

const rid = (prefix: string) => `${prefix}_fake_${randomBytes(7).toString('hex')}`;

/** Sends what Razorpay would: a signed webhook to our real endpoint, then runs the queue. */
export async function simulateRazorpay(
  linkId: string,
  outcome: 'paid' | 'failed',
): Promise<ApiResult<string>> {
  if (process.env.NODE_ENV === 'production') return { ok: false, error: 'Dev only.' };
  await requireUser();
  const payment = await getPaymentByLinkId(linkId);
  if (!payment) return { ok: false, error: 'No payment for this link.' };

  const paymentEntity = {
    id: rid('pay'),
    entity: 'payment',
    amount: payment.amountPaise,
    currency: 'INR',
    status: outcome === 'paid' ? 'captured' : 'failed',
    method: 'upi',
  };
  const event =
    outcome === 'paid'
      ? {
          entity: 'event',
          event: 'payment_link.paid',
          contains: ['payment_link', 'payment'],
          payload: {
            payment_link: {
              entity: {
                id: linkId,
                amount: payment.amountPaise,
                amount_paid: payment.amountPaise,
                currency: 'INR',
                reference_id: payment.id,
                status: 'paid',
                short_url: payment.razorpayLinkUrl,
              },
            },
            payment: { entity: paymentEntity },
          },
          created_at: Math.floor(Date.now() / 1000),
        }
      : {
          entity: 'event',
          event: 'payment.failed',
          contains: ['payment'],
          payload: { payment: { entity: paymentEntity } },
          created_at: Math.floor(Date.now() / 1000),
        };

  const body = JSON.stringify(event);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const res = await fetch(new URL('/api/webhooks/razorpay', origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signRazorpayBody(body, config.RAZORPAY_WEBHOOK_SECRET),
      'x-razorpay-event-id': rid('evt'),
    },
    body,
  });
  if (!res.ok) return { ok: false, error: `Webhook rejected (${res.status}).` };

  const { failed } = await runJobsNow();
  if (failed.length) return { ok: false, error: failed.map((f) => f.error).join('; ') };
  return {
    ok: true,
    data:
      outcome === 'paid'
        ? 'Payment captured — the lead should now be enrolled.'
        : 'Payment failed — the link stays open.',
  };
}
