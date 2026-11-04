import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMessages, sendText } from '@/modules/messaging';
import { db, hasTestDb, resetDb } from '../helpers/db';

// after() needs a real request, so collect its callbacks and run them by hand.
const afterResponse = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock('next/server', async (actual) => ({
  ...(await actual<typeof import('next/server')>()),
  after: (run: () => unknown) => afterResponse.push(run),
}));

const newLead = () =>
  db.lead.create({
    data: { phoneE164: '+919812345678', source: 'CTWA_AD', lastInboundAt: new Date() },
  });

describe.skipIf(!hasTestDb)('background send', () => {
  beforeEach(async () => {
    await resetDb();
    afterResponse.length = 0;
  });

  it('returns the QUEUED row under the given id, then goes to SENT after the response', async () => {
    const lead = await newLead();
    const id = randomUUID();
    const row = await sendText(lead.id, 'Hello', { sentBy: 'staff', id, background: true });
    expect(row).toMatchObject({ id, status: 'QUEUED', waMessageId: null });

    await afterResponse[0]?.();
    const sent = await db.message.findUniqueOrThrow({ where: { id } });
    expect(sent.status).toBe('SENT');
    expect(sent.waMessageId).toBeTruthy();
  });

  it('a send refused after the response ends up FAILED and in the inbox, without throwing', async () => {
    const lead = await newLead();
    const id = randomUUID();
    const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Too long for Meta, so the fake rejects it.
    await sendText(lead.id, 'x'.repeat(5000), { sentBy: 'staff', id, background: true });

    await afterResponse[0]?.();
    silenced.mockRestore();
    const failed = await db.message.findUniqueOrThrow({ where: { id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.errorCode).toContain('WhatsAppLimitError');
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(true);
  });
});

describe.skipIf(!hasTestDb)('listMessages since', () => {
  beforeEach(resetDb);

  it('returns rows changed since then, including status changes on older messages', async () => {
    const lead = await newLead();
    const old = new Date(Date.now() - 60_000);
    const message = (body: string, updatedAt: Date) =>
      db.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUT',
          type: 'TEXT',
          body: { text: body },
          status: 'SENT',
          sentBy: 'staff',
          createdAt: old,
          updatedAt,
        },
      });
    await message('untouched', old);
    const ticked = await message('ticked', old);
    const since = new Date();
    await db.message.update({ where: { id: ticked.id }, data: { status: 'DELIVERED' } });

    const changed = await listMessages(lead.id, since);
    expect(changed.map((m) => [m.id, m.status])).toEqual([[ticked.id, 'DELIVERED']]);
    expect(await listMessages(lead.id)).toHaveLength(2);
  });

  it('reads a little behind the cursor, so a change committed late still arrives', async () => {
    const lead = await newLead();
    const row = await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'OUT',
        type: 'TEXT',
        body: {},
        status: 'SENT',
        sentBy: 'staff',
      },
    });
    const justAfter = new Date(row.updatedAt.getTime() + 1000);
    expect(await listMessages(lead.id, justAfter)).toHaveLength(1);
  });
});
