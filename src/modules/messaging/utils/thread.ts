import type { Message } from '@/generated/prisma/client';
import { istDate } from '@/modules/core/utils';
import type { ChatMessage, MessageBody } from '../types';

// Thread logic shared by server and browser. Pure, so the tests can pin the rules down.

/** Statuses only move forward: receipts arrive out of order, and over more than one path. */
export const STATUS_RANK = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 } as const;

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
  };
}

/** Stable across optimistic bubble → saved row, so React keeps the same DOM node and nothing jumps. */
export const bubbleKey = (m: ChatMessage) => m.body.clientId ?? m.id;

/** A send the server refused or never received: it exists in this browser only. */
export const isLocalOnly = (m: ChatMessage) => m.id === m.body.clientId;

const inOrder = (a: ChatMessage, b: ChatMessage) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Upsert by id or clientId, oldest first. An older copy of a row can't move its ticks backwards. */
export function mergeMessages(held: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byKey = new Map(held.map((m) => [bubbleKey(m), m]));
  for (const m of incoming) {
    const key = bubbleKey(m);
    const cur = byKey.get(key);
    const stale = cur && !isLocalOnly(cur) && STATUS_RANK[m.status] < STATUS_RANK[cur.status];
    byKey.set(key, stale ? { ...m, status: cur.status, errorCode: cur.errorCode } : m);
  }
  return [...byKey.values()].sort(inOrder);
}

/** useOptimistic reducer: the saved row may already have arrived by push, and then it wins. */
export const appendPending = (held: ChatMessage[], pending: ChatMessage) =>
  held.some((m) => bubbleKey(m) === bubbleKey(pending)) ? held : [...held, pending];

/**
 * First message of the lead's latest unanswered run: the inbox's "they wrote last" rule. Bot-answered
 * messages stay DELIVERED for good, so "not READ" alone would mark most of the thread as unread.
 */
export function firstUnreadKey(messages: ChatMessage[]): string | null {
  let first: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction !== 'IN' || m.status === 'READ') break;
    first = bubbleKey(m);
  }
  return first;
}

const GROUP_MS = 2 * 60_000;

const istDay = (m: ChatMessage) => istDate(new Date(m.createdAt)).getTime();

const sameGroup = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
  !!a &&
  !!b &&
  a.direction === b.direction &&
  istDay(a) === istDay(b) &&
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() <= GROUP_MS;

export type ThreadItem =
  | { kind: 'day'; key: string; at: string }
  | { kind: 'unread'; key: string }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      startsGroup: boolean;
      endsGroup: boolean;
    };

/** What the thread renders, in order: bubbles with their grouping, date separators, the unread divider. */
export function buildThread(messages: ChatMessage[], unreadKey: string | null): ThreadItem[] {
  return messages.flatMap((m, i): ThreadItem[] => {
    const prev = messages[i - 1];
    const key = bubbleKey(m);
    return [
      ...(!prev || istDay(prev) !== istDay(m)
        ? [{ kind: 'day' as const, key: `day-${istDay(m)}`, at: m.createdAt }]
        : []),
      ...(key === unreadKey ? [{ kind: 'unread' as const, key: 'unread' }] : []),
      {
        kind: 'message',
        key,
        message: m,
        startsGroup: !sameGroup(prev, m),
        endsGroup: !sameGroup(m, messages[i + 1]),
      },
    ];
  });
}

export const POLL_MS = 3_000;
export const IDLE_POLL_MS = 10_000;
const IDLE_AFTER_MS = 60_000;

/** Wait before the next poll. null = don't poll: realtime is delivering, or the tab is hidden. */
export function nextPollDelay(state: {
  realtime: boolean;
  hidden: boolean;
  idleMs: number;
}): number | null {
  if (state.realtime || state.hidden) return null;
  return state.idleMs >= IDLE_AFTER_MS ? IDLE_POLL_MS : POLL_MS;
}
