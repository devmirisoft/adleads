import { beforeEach, describe, expect, it } from 'vitest';
import { countInbox, listInbox } from '@/modules/leads';
import { db, hasTestDb, makeLead, resetDb } from '../helpers/db';

const message = (leadId: string, direction: 'IN' | 'OUT') =>
  db.message.create({
    data: {
      leadId,
      direction,
      type: 'TEXT',
      body: { text: 'Hi' },
      status: direction === 'IN' ? 'DELIVERED' : 'SENT',
      sentBy: direction === 'IN' ? 'lead' : 'bot',
    },
  });

describe.skipIf(!hasTestDb)('listInbox()', () => {
  beforeEach(resetDb);

  it('defaults to leads waiting for a person; `all` is every conversation', async () => {
    const waiting = await makeLead();
    await message(waiting.id, 'IN');
    const answered = await makeLead();
    await message(answered.id, 'OUT');
    const optedOut = await makeLead('OPTED_OUT');
    await message(optedOut.id, 'IN');
    await makeLead(); // never messaged: not a conversation

    const needs = await listInbox({});
    expect(needs.items.map((l) => l.id)).toEqual([waiting.id]);
    expect(needs.total).toBe(1);
    expect(await countInbox()).toBe(1); // nav badge counts only what's waiting

    const all = await listInbox({ all: true });
    expect(all.items.map((l) => l.id).sort()).toEqual(
      [waiting.id, answered.id, optedOut.id].sort(),
    );
    expect(all.total).toBe(3);
  });
});
