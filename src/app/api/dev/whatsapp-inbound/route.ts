import type { Prisma } from '@/generated/prisma/client';
import { recordWebhook } from '@/modules/jobs';
import { metaEventKey } from '@/modules/messaging';
import { runJobsNow } from '../../../_jobs/handlers';

// Dev stand-in for Meta: same path as the real webhook (store event → queue processWebhook),
// minus the signature check, and the queue is run immediately so the reply shows up at once.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const raw = await req.text();
  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return Response.json({ error: 'Body is not JSON.' }, { status: 400 });
  }
  const { duplicate } = await recordWebhook('META', metaEventKey(payload, raw), payload);
  const { failed } = await runJobsNow();
  return Response.json({ duplicate, failed: failed.map((f) => `${f.type}: ${f.error}`) });
}
