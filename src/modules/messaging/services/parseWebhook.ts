import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { InboundMessage, StatusUpdate } from '../types';

// Meta WhatsApp Cloud API webhook → our types. Lenient: unknown fields are ignored, unsupported
// message types come through as kind "other", and one bad item never fails the batch.

const metaMessage = z.object({
  // Username senders may have no `from`, only `from_user_id`.
  from: z.string().optional(),
  from_user_id: z.string().optional(),
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
    .optional()
    .catch(undefined), // Better a message without ad attribution than no message.
});

const metaStatus = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).or(z.string()),
  errors: z.array(z.object({ code: z.number(), title: z.string().optional() })).optional(),
});

const metaContact = z.object({
  wa_id: z.string().optional(),
  user_id: z.string().optional(),
  profile: z.object({ name: z.string() }).optional(),
});

/** A malformed item becomes null (and a note) instead of rejecting its siblings. */
const items = <T extends z.ZodType>(item: T) => z.array(item.nullable().catch(null)).catch([]);

const metaValue = z
  .object({
    contacts: items(metaContact),
    messages: items(metaMessage),
    statuses: items(metaStatus),
  })
  .catch({ contacts: [], messages: [], statuses: [] });

// `value` stays unknown here: other fields (calls, account_update…) have their own shapes.
const metaPayload = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({ changes: z.array(z.object({ field: z.string(), value: z.unknown() })) }),
  ),
});

/** A wa_id already has its country code; normalizePhone would read +65 numbers as bare Indian mobiles. */
const waIdToE164 = (waId: string) => (/^[1-9]\d{7,14}$/.test(waId) ? `+${waId}` : null);

/** Past this a key could overflow the unique index on event_key, which would reject the webhook. */
const MAX_KEY_LENGTH = 1000;

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
  /** What was ignored and why, for webhook_events.error. Never holds a phone number. */
  notes: string[];
} {
  const { entry } = metaPayload.parse(payload);
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const notes: string[] = [];

  for (const { changes } of entry) {
    for (const { field, value: raw } of changes) {
      if (field !== 'messages') {
        notes.push(`Ignored field: ${field}`);
        continue;
      }
      const value = metaValue.parse(raw);
      const contacts = value.contacts.filter((c) => c !== null);
      const names = new Map(contacts.map((c) => [c.wa_id, c.profile?.name]));

      for (const m of value.messages) {
        if (!m) {
          notes.push('Skipped a malformed message');
          continue;
        }
        const waId =
          m.from ?? contacts.find((c) => c.user_id && c.user_id === m.from_user_id)?.wa_id;
        const phone = waId && waIdToE164(waId);
        // ponytail: leads are keyed by phone, so a username-only sender can't become a lead yet;
        // the raw event stays in webhook_events for a backfill once leads can store user_id.
        // Add wa_user_id before scaling ad spend: username adoption will grow and these are lost leads.
        if (!waId || !phone) {
          notes.push('Skipped a message with no usable phone number');
          continue;
        }
        const base = {
          waId,
          phone,
          profileName: names.get(waId),
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

      for (const s of value.statuses) {
        if (!s) {
          notes.push('Skipped a malformed status');
          continue;
        }
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
  return { messages, statuses, notes };
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** webhook_events.event_key: the message/status ids in the payload (so redeliveries dedupe). */
export function metaEventKey(payload: unknown, rawBody: string): string {
  try {
    const { messages, statuses } = parseMetaWebhook(payload);
    const ids = [
      ...messages.map((m) => m.messageId),
      ...statuses.map((s) => `${s.waMessageId}:${s.status}`),
    ];
    const key = ids.join(',');
    if (key) return `meta:${key.length > MAX_KEY_LENGTH ? `sha256:${sha256(key)}` : key}`;
  } catch {
    // fall through to the body hash
  }
  return `meta:sha256:${sha256(rawBody)}`;
}
