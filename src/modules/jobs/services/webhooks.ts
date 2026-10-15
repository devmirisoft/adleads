import 'server-only';
import type { Prisma, WebhookProvider } from '@/generated/prisma/client';
import { db, isUniqueViolation } from '@/lib/db';
import { enqueue } from './queue';

/**
 * Webhook intake: store the raw event + queue `processWebhook`, atomically.
 * `duplicate: true` means this event_key was seen before (providers redeliver) — nothing queued.
 */
export async function recordWebhook(
  provider: WebhookProvider,
  eventKey: string,
  payload: Prisma.InputJsonValue,
): Promise<{ duplicate: boolean }> {
  try {
    await db.$transaction(async (tx) => {
      const event = await tx.webhookEvent.create({ data: { provider, eventKey, payload } });
      await enqueue('processWebhook', { webhookEventId: String(event.id) }, { tx });
    });
    return { duplicate: false };
  } catch (e) {
    if (isUniqueViolation(e)) return { duplicate: true };
    throw e;
  }
}

export function getWebhookEvent(id: string) {
  return db.webhookEvent.findUniqueOrThrow({ where: { id: BigInt(id) } });
}

export async function markWebhookProcessed(id: string, error?: string) {
  await db.webhookEvent.update({
    where: { id: BigInt(id) },
    data: error ? { error } : { processedAt: new Date(), error: null },
  });
}
