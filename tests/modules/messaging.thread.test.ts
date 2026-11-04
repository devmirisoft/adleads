import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/modules/messaging';
import {
  appendPending,
  bubbleKey,
  buildThread,
  firstUnreadKey,
  IDLE_POLL_MS,
  mergeMessages,
  nextPollDelay,
  POLL_MS,
} from '@/modules/messaging/utils/thread';

const at = (minute: number, day = 14) =>
  `2026-10-${day}T10:${String(minute).padStart(2, '0')}:00.000Z`;

function msg(id: string, over: Partial<ChatMessage> = {}, clientId?: string): ChatMessage {
  return {
    id,
    direction: 'OUT',
    type: 'TEXT',
    templateName: null,
    body: { text: id, ...(clientId && { clientId }) },
    status: 'SENT',
    errorCode: null,
    sentBy: 'x',
    createdAt: at(0),
    ...over,
  };
}
const ids = (list: ChatMessage[]) => list.map((m) => m.id);

describe('mergeMessages', () => {
  it('replaces an optimistic bubble with the saved row carrying its clientId, without duplicating', () => {
    const pending = msg('c1', { status: 'QUEUED' }, 'c1');
    const created = msg('row-1', { status: 'QUEUED' }, 'c1');
    const merged = mergeMessages([pending], [created]);
    expect(ids(merged)).toEqual(['row-1']);
    // The same key means React keeps the DOM node, so the bubble doesn't remount or jump.
    expect(bubbleKey(merged[0])).toBe(bubbleKey(pending));
  });

  it('ignores the same row arriving twice (push, then a poll, then the action result)', () => {
    const row = msg('row-1', {}, 'c1');
    expect(ids(mergeMessages(mergeMessages([], [row]), [row, row]))).toEqual(['row-1']);
  });

  it.each([
    ['DELIVERED', 'SENT'],
    ['READ', 'DELIVERED'],
    ['READ', 'QUEUED'],
    ['FAILED', 'READ'],
  ] as const)('never moves ticks backwards: %s stays over a late %s', (held, late) => {
    const merged = mergeMessages(
      [msg('m', { status: held, errorCode: 'kept' })],
      [msg('m', { status: late })],
    );
    expect(merged[0].status).toBe(held);
    expect(merged[0].errorCode).toBe('kept');
  });

  it.each([
    ['QUEUED', 'SENT'],
    ['SENT', 'DELIVERED'],
    ['DELIVERED', 'READ'],
    ['SENT', 'FAILED'],
  ] as const)('moves ticks forward: %s to %s', (held, next) => {
    expect(
      mergeMessages([msg('m', { status: held })], [msg('m', { status: next })])[0].status,
    ).toBe(next);
  });

  it('keeps time order whichever order rows arrive in, with id as the tie-break', () => {
    const merged = mergeMessages(
      [msg('b', { createdAt: at(5) }), msg('d', { createdAt: at(9) })],
      [msg('c', { createdAt: at(5) }), msg('a', { createdAt: at(1) })],
    );
    expect(ids(merged)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lets a saved row replace a send this browser wrongly marked failed', () => {
    // The action call dropped on the network, but the server had already saved it.
    const local = msg('c1', { status: 'FAILED', errorCode: 'offline' }, 'c1');
    const merged = mergeMessages([local], [msg('row-1', { status: 'QUEUED' }, 'c1')]);
    expect(merged[0]).toMatchObject({ id: 'row-1', status: 'QUEUED', errorCode: null });
  });
});

describe('appendPending', () => {
  it('adds a pending bubble at the end', () => {
    expect(ids(appendPending([msg('a')], msg('c1', {}, 'c1')))).toEqual(['a', 'c1']);
  });

  it('adds nothing when the saved row already arrived by push', () => {
    const held = [msg('row-1', { status: 'SENT' }, 'c1')];
    expect(appendPending(held, msg('c1', { status: 'QUEUED' }, 'c1'))).toBe(held);
  });
});

describe('firstUnreadKey', () => {
  const inbound = (id: string, status: ChatMessage['status'] = 'DELIVERED') =>
    msg(id, { direction: 'IN', status });

  it('is the start of the run of messages since we last replied', () => {
    expect(firstUnreadKey([inbound('old'), msg('reply'), inbound('a'), inbound('b')])).toBe('a');
  });

  it('is null once we replied, even though old inbound rows stay DELIVERED', () => {
    expect(firstUnreadKey([inbound('old'), msg('reply')])).toBeNull();
  });

  it('stops at messages already read', () => {
    expect(firstUnreadKey([inbound('read', 'READ'), inbound('new')])).toBe('new');
    expect(firstUnreadKey([inbound('read', 'READ')])).toBeNull();
  });
});

describe('buildThread', () => {
  const groups = (items: ReturnType<typeof buildThread>) =>
    items.flatMap((i) => (i.kind === 'message' ? [[i.startsGroup, i.endsGroup]] : []));

  it('groups the same side within 2 minutes, and nothing else', () => {
    const items = buildThread(
      [
        msg('a', { createdAt: at(0) }),
        msg('b', { createdAt: at(2) }),
        msg('c', { createdAt: at(5) }), // 3 min gap
        msg('d', { createdAt: at(5), direction: 'IN' }), // other side
      ],
      null,
    );
    expect(groups(items)).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
    ]);
  });

  it('adds a separator per IST day, not UTC day', () => {
    // 18:20 and 18:40 UTC on the 14th are 23:50 on the 14th and 00:10 on the 15th in IST.
    const items = buildThread(
      [
        msg('a', { createdAt: '2026-10-14T18:20:00.000Z' }),
        msg('b', { createdAt: '2026-10-14T18:40:00.000Z' }),
        msg('c', { createdAt: '2026-10-14T18:41:00.000Z' }),
      ],
      null,
    );
    expect(items.map((i) => i.kind)).toEqual(['day', 'message', 'day', 'message', 'message']);
  });

  it('never groups across midnight, even within 2 minutes', () => {
    const items = buildThread(
      [
        msg('a', { createdAt: '2026-10-14T18:29:30.000Z' }),
        msg('b', { createdAt: '2026-10-14T18:30:30.000Z' }),
      ],
      null,
    );
    expect(groups(items)).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  it('puts the unread divider right before the first unread message', () => {
    const items = buildThread(
      [msg('a', { createdAt: at(0) }), msg('b', { createdAt: at(1), direction: 'IN' })],
      'b',
    );
    expect(items.map((i) => i.kind)).toEqual(['day', 'message', 'unread', 'message']);
  });
});

describe('nextPollDelay', () => {
  const state = { realtime: false, hidden: false, idleMs: 0 };

  it('polls every 3 s while active, 10 s after a minute idle', () => {
    expect(nextPollDelay(state)).toBe(POLL_MS);
    expect(nextPollDelay({ ...state, idleMs: 59_999 })).toBe(POLL_MS);
    expect(nextPollDelay({ ...state, idleMs: 60_000 })).toBe(IDLE_POLL_MS);
    expect([POLL_MS, IDLE_POLL_MS]).toEqual([3000, 10_000]);
  });

  it('stops while the tab is hidden or realtime is connected', () => {
    expect(nextPollDelay({ ...state, hidden: true })).toBeNull();
    expect(nextPollDelay({ ...state, realtime: true })).toBeNull();
  });
});
