import type { NextRequest } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { config } from '@/lib/config';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/verify';
import { recordWebhook } from '@/modules/jobs';
import { metaEventKey } from '@/modules/messaging';
import { runJobsAfterResponse } from '../../../_jobs/handlers';

export const maxDuration = 60;

/** Meta's one-time subscription handshake: echo hub.challenge if the verify token matches. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === config.WA_VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Verify → store → 200, then run the processWebhook job straight after the response. */
export async function POST(req: Request) {
  // TEMP diagnostics: stage logs and the outer try/catch. Booleans, lengths and timings only.
  // The key is not logged: real wamids encode the sender's phone number.
  const startedAt = Date.now();
  console.log('[wa] enter', { uptimeS: Math.round(process.uptime()) });
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    console.log('[wa] hit', {
      bodyLength: raw.length,
      hasSignature: Boolean(signature),
      hasSecret: Boolean(config.WA_APP_SECRET),
      bodyMs: Date.now() - startedAt,
    });
    let stageAt = Date.now();
    const signatureOk = verifyWhatsAppSignature(raw, signature, config.WA_APP_SECRET);
    console.log('[wa] sig ok?', signatureOk, { ms: Date.now() - stageAt });
    if (!signatureOk) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    let payload: Prisma.InputJsonValue;
    try {
      payload = JSON.parse(raw) as Prisma.InputJsonValue;
    } catch {
      return Response.json({ error: 'Body is not JSON' }, { status: 400 });
    }
    stageAt = Date.now();
    // Same message/status ids → same key, so Meta's retries are stored once.
    const eventKey = metaEventKey(payload, raw);
    console.log('[wa] key', { keyLength: eventKey.length, ms: Date.now() - stageAt });
    stageAt = Date.now();
    const { duplicate } = await recordWebhook('META', eventKey, payload);
    console.log('[wa] stored', {
      duplicate,
      ms: Date.now() - stageAt,
      totalMs: Date.now() - startedAt,
    });
    if (!duplicate) runJobsAfterResponse();
    return Response.json({ ok: true });
  } catch (e) {
    const { name, message, code } = e as { name?: string; message?: string; code?: unknown };
    // Prisma puts the actual reason at the end of the message, after a source-code frame.
    console.error('[wa] FAILED', {
      name,
      code,
      message: message?.slice(-300),
      afterMs: Date.now() - startedAt,
    });
    return Response.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
