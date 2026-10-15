import type { NextRequest } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { config } from '@/lib/config';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/verify';
import { recordWebhook } from '@/modules/jobs';
import { metaEventKey } from '@/modules/messaging';

/** Meta's one-time subscription handshake: echo hub.challenge if the verify token matches. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === config.WA_VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Verify → store → 200. All work happens later in the processWebhook job. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!verifyWhatsAppSignature(raw, signature, config.WA_APP_SECRET)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return Response.json({ error: 'Body is not JSON' }, { status: 400 });
  }
  // Same message/status ids → same key, so Meta's retries are stored once.
  await recordWebhook('META', metaEventKey(payload, raw), payload);
  return Response.json({ ok: true });
}
