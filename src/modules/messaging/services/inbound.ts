import 'server-only';
import { db, isUniqueViolation } from '@/lib/db';
import type { ChatPage, InboundMessage, MessageBody, StatusUpdate } from '../types';
import { STATUS_RANK, toChatMessage } from '../utils/thread';
import { publishMessage } from './events';

export async function hasMessage(waMessageId: string): Promise<boolean> {
  return !!(await db.message.findUnique({ where: { waMessageId }, select: { id: true } }));
}

/** Logs an inbound message. Returns false if this wa_message_id was already stored (duplicate delivery). */
export async function recordInbound(leadId: string, msg: InboundMessage): Promise<boolean> {
  const body: MessageBody = { text: msg.text, replyId: msg.replyId };
  try {
    const row = await db.message.create({
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
    await publishMessage('message.created', row);
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/** Delivery receipts from Meta. Statuses only move forward (they can arrive out of order). */
export async function applyStatus(update: StatusUpdate): Promise<void> {
  const msg = await db.message.findUnique({ where: { waMessageId: update.waMessageId } });
  if (!msg || STATUS_RANK[update.status] <= STATUS_RANK[msg.status]) return;
  const updated = await db.message.update({
    where: { id: msg.id },
    data: { status: update.status, ...(update.errorCode && { errorCode: update.errorCode }) },
  });
  if (update.status === 'FAILED') {
    await db.lead.update({ where: { id: msg.leadId }, data: { needsHuman: true } }); // puts it in /inbox
  }
  await publishMessage('message.status', updated);
}

const PAGE_SIZE = 50;

// updatedAt is stamped by the function before its write commits, so a change can land just behind a
// cursor already handed out. Starting each cursor a little in the past re-reads that gap; the
// browser merges by id, so the repeats are harmless.
const CURSOR_OVERLAP_MS = 10_000;
const nextCursor = () => new Date(Date.now() - CURSOR_OVERLAP_MS).toISOString();

/** The newest page of a lead's thread, or the page older than message `before`. */
export async function listMessages(
  leadId: string,
  { before }: { before?: string } = {},
): Promise<ChatPage> {
  const cursor = nextCursor();
  const rows = await db.message.findMany({
    where: { leadId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(before && { cursor: { id: before }, skip: 1 }),
  });
  return {
    messages: rows.slice(0, PAGE_SIZE).reverse().map(toChatMessage),
    hasMore: rows.length > PAGE_SIZE,
    cursor,
  };
}

/** Rows created or changed since a cursor: new messages and tick updates on older ones alike. */
export async function listMessagesSince(leadId: string, since: Date) {
  const cursor = nextCursor();
  const rows = await db.message.findMany({
    where: { leadId, updatedAt: { gt: since } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return { messages: rows.map(toChatMessage), cursor };
}
