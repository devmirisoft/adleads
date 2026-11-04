import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/admin/leads/[id]/messages/route';
import { applyStatus, type ChatPage } from '@/modules/messaging';
import { mergeMessages } from '@/modules/messaging/utils/thread';
import { db, hasTestDb, makeLead, resetDb } from '../helpers/db';

vi.mock('@/modules/auth', async (original) => ({
  ...(await original<typeof import('@/modules/auth')>()),
  requireUser: async () => ({ id: 'staff', role: 'VIEWER' }),
}));

const T0 = new Date('2026-10-14T10:00:00.000Z').getTime();
const minute = (n: number) => new Date(T0 + n * 60_000);

/** A row as of minute `n`, written directly so tests control both timestamps. */
const row = (leadId: string, n: number, extra: { waMessageId?: string } = {}) =>
  db.message.create({
    data: {
      leadId,
      direction: 'OUT',
      type: 'TEXT',
      body: { text: `m${n}` },
      status: 'SENT',
      sentBy: 'bot',
      createdAt: minute(n),
      updatedAt: minute(n),
      ...extra,
    },
  });

async function get(leadId: string, query = '') {
  const res = await GET(new NextRequest(`http://x/api/admin/leads/${leadId}/messages${query}`), {
    params: Promise.resolve({ id: leadId }),
  });
  return { res, page: (await res.json()) as ChatPage };
}
const texts = (page: ChatPage) => page.messages.map((m) => m.body.text);

describe.skipIf(!hasTestDb)('GET /api/admin/leads/[id]/messages', () => {
  beforeEach(resetDb);

  it('?after= returns only rows newer than the cursor', async () => {
    const lead = await makeLead();
    await row(lead.id, 1);
    await row(lead.id, 2);
    await row(lead.id, 3);
    const { page } = await get(lead.id, `?after=${minute(1).toISOString()}`);
    expect(texts(page)).toEqual(['m2', 'm3']);
  });

  it('?after= also returns status changes on older messages', async () => {
    const lead = await makeLead();
    await row(lead.id, 1, { waMessageId: 'wamid.1' });
    await row(lead.id, 2);
    await applyStatus({ waMessageId: 'wamid.1', status: 'READ' }); // updatedAt is now
    const { page } = await get(lead.id, `?after=${minute(5).toISOString()}`);
    expect(page.messages.map((m) => [m.body.text, m.status])).toEqual([['m1', 'READ']]);
  });

  it('?after= with nothing changed is empty, and its cursor overlaps so late commits are not lost', async () => {
    const lead = await makeLead();
    await row(lead.id, 1);
    const before = Date.now();
    const { page } = await get(lead.id, `?after=${new Date().toISOString()}`);
    expect(page.messages).toEqual([]);
    expect(new Date(page.cursor).getTime()).toBeLessThan(before);
  });

  it('polling merges into what is held without reordering', async () => {
    const lead = await makeLead();
    await row(lead.id, 1);
    await row(lead.id, 2);
    const { page: first } = await get(lead.id);
    await row(lead.id, 3);
    const { page: next } = await get(lead.id, `?after=${minute(2).toISOString()}`);
    const merged = mergeMessages(first.messages, next.messages);
    expect(merged.map((m) => m.body.text)).toEqual(['m1', 'm2', 'm3']);
  });

  it('pages backwards with ?before= and says when more remain', async () => {
    const lead = await makeLead();
    for (let n = 1; n <= 53; n++) await row(lead.id, n);

    const { page: newest } = await get(lead.id);
    expect(newest.messages).toHaveLength(50);
    expect(newest.messages[0].body.text).toBe('m4');
    expect(newest.messages.at(-1)?.body.text).toBe('m53');
    expect(newest.hasMore).toBe(true);

    const { page: older } = await get(lead.id, `?before=${newest.messages[0].id}`);
    expect(texts(older)).toEqual(['m1', 'm2', 'm3']);
    expect(older.hasMore).toBe(false);
  });

  it('only ever returns this lead', async () => {
    const lead = await makeLead();
    const other = await makeLead();
    await row(other.id, 2);
    const { page } = await get(lead.id, `?after=${minute(1).toISOString()}`);
    expect(page.messages).toEqual([]);
  });

  it('is never cached', async () => {
    const lead = await makeLead();
    const { res } = await get(lead.id);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each(['?after=yesterday', '?before=not-a-uuid'])('rejects a bad cursor: %s', async (query) => {
    const lead = await makeLead();
    const { res } = await get(lead.id, query);
    expect(res.status).toBe(400);
  });
});
