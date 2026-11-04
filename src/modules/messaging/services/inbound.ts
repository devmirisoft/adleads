import 'server-only';
import type { Message } from '@/generated/prisma/client';
import { db, isUniqueViolation } from '@/lib/db';
import type { ChatMessage, InboundMessage, MessageBody, StatusUpdate } from '../types';

export async function hasMessage(waMessageId: string): Promise<boolean> {
  return !!(await db.message.findUnique({ where: { waMessageId }, select: { id: true } }));
}

/** Logs an inbound message. Returns false if this wa_message_id was already stored (duplicate delivery). */
export async function recordInbound(leadId: string, msg: InboundMessage): Promise<boolean> {
  const body: MessageBody = { text: msg.text, replyId: msg.replyId };
  try {
    await db.message.create({
      data: {
        leadId,
        direction: 'IN',
        waMessageId: msg.messageId,
        type: msg.kind === 'text' ? 'TEXT' : msg.kind === 'other' ? 'MEDIA' : 'INTERACTIVE',
        body,
        status: 'DELIVERED',
        sentBy: 'lead',
      },
    });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

const RANK = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 } as const;

/** Delivery receipts from Meta. Statuses only move forward (they can arrive out of order). */
export async function applyStatus(update: StatusUpdate): Promise<void> {
  const msg = await db.message.findUnique({ where: { waMessageId: update.waMessageId } });
  if (!msg || RANK[update.status] <= RANK[msg.status]) return;
  await db.message.update({
    where: { id: msg.id },
    data: { status: update.status, ...(update.errorCode && { errorCode: update.errorCode }) },
  });
  if (update.status === 'FAILED') {
    await db.lead.update({ where: { id: msg.leadId }, data: { needsHuman: true } }); // puts it in /inbox
  }
}

/** A Message row in the shape the browser gets. */
export function toChatMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    direction: m.direction,
    type: m.type,
    templateName: m.templateName,
    body: m.body as MessageBody, // only ever written by this module, in this shape
    status: m.status,
    errorCode: m.errorCode,
    sentBy: m.sentBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// updatedAt is stamped before the row commits, so a change can land just behind a `since` already
// handed out. Reading a little further back catches it; the browser merges by id, so repeats are harmless.
const SINCE_OVERLAP_MS = 5000;

/** A lead's thread for chat views (oldest first). With `since`: only rows changed from then on. */
export async function listMessages(leadId: string, since?: Date): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: {
      leadId,
      ...(since && { updatedAt: { gte: new Date(since.getTime() - SINCE_OVERLAP_MS) } }),
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toChatMessage);
}
