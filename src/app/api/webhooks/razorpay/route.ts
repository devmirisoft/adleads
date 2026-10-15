import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { config } from '@/lib/config';
import { verifyRazorpaySignature } from '@/lib/razorpay/client';
import { recordWebhook } from '@/modules/jobs';

// Verify → store → 200. All work happens later in the processWebhook job.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!verifyRazorpaySignature(raw, signature, config.RAZORPAY_WEBHOOK_SECRET)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return Response.json({ error: 'Body is not JSON' }, { status: 400 });
  }
  // Razorpay retries with the same event id; fall back to the body hash.
  const eventId =
    req.headers.get('x-razorpay-event-id') ?? createHash('sha256').update(raw).digest('hex');
  await recordWebhook('RAZORPAY', `razorpay:${eventId}`, payload);
  return Response.json({ ok: true });
}
