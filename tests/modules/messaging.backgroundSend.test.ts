import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendText } from '@/modules/messaging';
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

  it('returns the QUEUED row, then goes to SENT after the response', async () => {
    const lead = await newLead();
    const clientId = randomUUID();
    const row = await sendText(lead.id, 'Hello', { sentBy: 'staff', clientId, background: true });
    expect(row).toMatchObject({ status: 'QUEUED', waMessageId: null });

    await afterResponse[0]?.();
    const sent = await db.message.findUniqueOrThrow({ where: { id: row!.id } });
    expect(sent.status).toBe('SENT');
    expect(sent.waMessageId).toBeTruthy();
  });

  it('a send refused after the response ends up FAILED and in the inbox, without throwing', async () => {
    const lead = await newLead();
    const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Too long for Meta, so the fake rejects it.
    const row = await sendText(lead.id, 'x'.repeat(5000), { sentBy: 'staff', background: true });

    await afterResponse[0]?.();
    silenced.mockRestore();
    const failed = await db.message.findUniqueOrThrow({ where: { id: row!.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.errorCode).toContain('WhatsAppLimitError');
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(true);
  });
});
