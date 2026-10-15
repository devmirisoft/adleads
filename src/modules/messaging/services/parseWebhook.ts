import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizePhone } from '@/modules/core/utils';
import type { InboundMessage, StatusUpdate } from '../types';

// Meta WhatsApp Cloud API webhook → our types. Lenient: unknown fields are ignored and
// unsupported message types come through as kind "other" rather than failing the batch.

const metaMessage = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  // Template quick-reply tap
  button: z.object({ payload: z.string(), text: z.string() }).optional(),
  referral: z
    .object({
      source_id: z.string(),
      source_type: z.string().optional(),
      headline: z.string().optional(),
      ctwa_clid: z.string().optional(),
    })
    .optional(),
});

const metaStatus = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).or(z.string()),
  errors: z.array(z.object({ code: z.number(), title: z.string().optional() })).optional(),
});

const metaPayload = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            contacts: z
              .array(
                z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() }),
              )
              .optional(),
            messages: z.array(metaMessage).optional(),
            statuses: z.array(metaStatus).optional(),
          }),
        }),
      ),
    }),
  ),
});

const STATUS_MAP: Record<string, StatusUpdate['status']> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/** Throws if the payload isn't a WhatsApp Business webhook at all. */
export function parseMetaWebhook(payload: unknown): {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
} {
  const { entry } = metaPayload.parse(payload);
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];

  for (const { changes } of entry) {
    for (const { field, value } of changes) {
      if (field !== 'messages') continue;
      const names = new Map(value.contacts?.map((c) => [c.wa_id, c.profile?.name]));

      for (const m of value.messages ?? []) {
        const phone = normalizePhone(m.from);
        if (!phone) continue;
        const base = {
          waId: m.from,
          phone,
          profileName: names.get(m.from),
          messageId: m.id,
          timestamp: new Date(Number(m.timestamp) * 1000),
          ...(m.referral && {
            referral: {
              adId: m.referral.source_id,
              ctwaClid: m.referral.ctwa_clid,
              headline: m.referral.headline,
            },
          }),
        };
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
        if (m.type === 'text' && m.text) {
          messages.push({ ...base, kind: 'text', text: m.text.body });
        } else if (m.type === 'interactive' && reply) {
          const kind = m.interactive?.list_reply ? 'list' : 'button';
          messages.push({ ...base, kind, text: reply.title, replyId: reply.id });
        } else if (m.type === 'button' && m.button) {
          messages.push({
            ...base,
            kind: 'button',
            text: m.button.text,
            replyId: m.button.payload,
          });
        } else {
          messages.push({ ...base, kind: 'other' });
        }
      }

      for (const s of value.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (!status) continue;
        const err = s.errors?.[0];
        statuses.push({
          waMessageId: s.id,
          status,
          ...(err && { errorCode: `${err.code}${err.title ? `: ${err.title}` : ''}` }),
        });
      }
    }
  }
  return { messages, statuses };
}

/** webhook_events.event_key: the message/status ids in the payload (so redeliveries dedupe). */
export function metaEventKey(payload: unknown, rawBody: string): string {
  try {
    const { messages, statuses } = parseMetaWebhook(payload);
    const ids = [
      ...messages.map((m) => m.messageId),
      ...statuses.map((s) => `${s.waMessageId}:${s.status}`),
    ];
    if (ids.length) return `meta:${ids.join(',')}`;
  } catch {
    // fall through to the body hash
  }
  return `meta:sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
}
