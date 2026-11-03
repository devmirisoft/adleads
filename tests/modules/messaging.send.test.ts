import { beforeEach, describe, expect, it, vi } from 'vitest';
import { realtime } from '@/lib/realtime/client';
import { whatsapp } from '@/lib/whatsapp/client';
import { WhatsAppApiError } from '@/lib/whatsapp/types';
import {
  applyStatus,
  markInboundRead,
  recordInbound,
  sendReply,
  sendTemplateReply,
  showTyping,
} from '@/modules/messaging';
import { db, hasTestDb, makeLead, resetDb } from '../helpers/db';

// `after` and `connection` need a live Next request. Capture the callback so a test can run it
// "after the response".
const afterTasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => afterTasks.push(task),
  connection: async () => {},
}));

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/cache', async (original) => ({
  ...(await original<typeof import('next/cache')>()),
  refresh,
}));

const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth')>()),
  auth: async () => ({ user: { id: session.userId } }),
}));

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

async function signIn(role: 'ADMIN' | 'SALES' | 'VIEWER' = 'SALES') {
  const user = await db.user.create({
    data: { name: 'Staff', email: `${role}@x.test`, passwordHash: 'x', role },
  });
  session.userId = user.id;
}

function deferredSend() {
  let resolve!: (r: { waMessageId: string }) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<{ waMessageId: string }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const spy = vi.spyOn(whatsapp, 'sendText').mockReturnValue(promise);
  return { spy, resolve, reject };
}

const runAfter = () => Promise.all(afterTasks.splice(0).map((task) => task()));

/** [channel, event, message status] of every push so far, in order. */
function published(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map(([channel, event, data]) => [
    channel,
    event,
    (data as { message?: { status: string } }).message?.status,
  ]);
}

describe.skipIf(!hasTestDb)('sendReply', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    refresh.mockClear();
    afterTasks.length = 0;
    await resetDb();
    await signIn();
  });

  it('returns the QUEUED row before the adapter is even called, and goes SENT after', async () => {
    const lead = await makeLead();
    const { spy, resolve } = deferredSend();

    const res = await sendReply(lead.id, ' Hello ', CLIENT_ID);

    expect(res).toMatchObject({
      ok: true,
      data: { status: 'QUEUED', body: { text: 'Hello', clientId: CLIENT_ID } },
    });
    expect(spy).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled(); // no full-page refresh

    const running = runAfter();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledOnce());
    const row = await db.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(row.status).toBe('QUEUED'); // the adapter hasn't answered yet

    resolve({ waMessageId: 'wamid.ok' });
    await running;
    const sent = await db.message.findUniqueOrThrow({ where: { id: row.id } });
    expect(sent).toMatchObject({ status: 'SENT', waMessageId: 'wamid.ok' });
  });

  it('a Meta failure ends as FAILED with the masked error and flags the lead', async () => {
    const lead = await makeLead();
    const { reject } = deferredSend();
    const res = await sendReply(lead.id, 'Hello', CLIENT_ID);
    expect(res.ok).toBe(true);

    const running = runAfter();
    reject(new WhatsAppApiError('131030: Recipient *** not in allowed list'));
    await running; // doesn't reject: the failure lives on the row

    const row = await db.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(row.status).toBe('FAILED');
    expect(row.errorCode).toContain('Recipient ***');
    const flagged = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(flagged.needsHuman).toBe(true);
  });

  it('pushes the row, then its ticks, in that order, with the clientId for the browser', async () => {
    const lead = await makeLead();
    const push = vi.spyOn(realtime, 'publish');
    const { resolve } = deferredSend();

    const res = await sendReply(lead.id, 'Hello', CLIENT_ID);
    expect(res.ok).toBe(true);
    resolve({ waMessageId: 'wamid.ok' });
    await runAfter();

    const channel = `private-lead-${lead.id}`;
    expect(published(push)).toEqual([
      [channel, 'message.created', 'QUEUED'],
      ['private-inbox', 'inbox.changed', undefined],
      [channel, 'message.status', 'SENT'],
    ]);
    const [, , created] = push.mock.calls[0];
    expect(created).toMatchObject({ message: { body: { clientId: CLIENT_ID } } });
  });

  it('a failed send also tells the inbox', async () => {
    const lead = await makeLead();
    const push = vi.spyOn(realtime, 'publish');
    const { reject } = deferredSend();
    await sendReply(lead.id, 'Hello', CLIENT_ID);
    const running = runAfter();
    reject(new WhatsAppApiError('boom'));
    await running;
    const events = push.mock.calls.map(([, event]) => event);
    expect(events.filter((e) => e === 'inbox.changed')).toHaveLength(2);
    expect(published(push)).toContainEqual([`private-lead-${lead.id}`, 'message.status', 'FAILED']);
  });

  it('a push failure changes nothing about the send', async () => {
    const lead = await makeLead();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(realtime, 'publish').mockRejectedValue(new Error('Pusher down'));
    const { resolve } = deferredSend();
    expect((await sendReply(lead.id, 'Hello', CLIENT_ID)).ok).toBe(true);
    resolve({ waMessageId: 'wamid.ok' });
    await runAfter();
    const row = await db.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(row.status).toBe('SENT');
    expect(errors).toHaveBeenCalled();
  });

  it('keeps the 24-hour rule: refused up front, nothing logged, nothing queued', async () => {
    const lead = await makeLead();
    await db.lead.update({
      where: { id: lead.id },
      data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) },
    });
    const res = await sendReply(lead.id, 'Hello', CLIENT_ID);
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('24 hours') });
    expect(await db.message.count()).toBe(0);
    expect(afterTasks).toHaveLength(0);
  });

  it('keeps the opt-out rule', async () => {
    const lead = await makeLead();
    await db.lead.update({ where: { id: lead.id }, data: { optedOutAt: new Date() } });
    const res = await sendReply(lead.id, 'Hello', CLIENT_ID);
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('opted out') });
    expect(await db.message.count()).toBe(0);
  });

  it('rejects empty text and keeps VIEWER out', async () => {
    const lead = await makeLead();
    expect((await sendReply(lead.id, '   ', CLIENT_ID)).ok).toBe(false);
    await signIn('VIEWER');
    await expect(sendReply(lead.id, 'Hello', CLIENT_ID)).rejects.toThrow('NEXT_REDIRECT');
    expect(await db.message.count()).toBe(0);
  });

  it('sends templates the same way, outside the window too', async () => {
    const lead = await makeLead();
    await db.lead.update({ where: { id: lead.id }, data: { lastInboundAt: null } });
    const spy = vi.spyOn(whatsapp, 'sendTemplate').mockResolvedValue({ waMessageId: 'wamid.t' });
    const res = await sendTemplateReply(lead.id, 'trial_ended', { name: 'Rahul' }, CLIENT_ID);
    expect(res).toMatchObject({ ok: true, data: { status: 'QUEUED', type: 'TEMPLATE' } });
    expect(spy).not.toHaveBeenCalled();
    await runAfter();
    expect(spy).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe.skipIf(!hasTestDb)('events from the webhook path', () => {
  const inbound = (messageId: string) => ({
    waId: 'x',
    phone: '+919800000000',
    messageId,
    timestamp: new Date(),
    kind: 'text' as const,
    text: 'Hi',
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  it('recordInbound pushes a new message and tells the inbox, but not a duplicate delivery', async () => {
    const lead = await makeLead();
    const push = vi.spyOn(realtime, 'publish');
    expect(await recordInbound(lead.id, inbound('wamid.in'))).toBe(true);
    expect(published(push)).toEqual([
      [`private-lead-${lead.id}`, 'message.created', 'DELIVERED'],
      ['private-inbox', 'inbox.changed', undefined],
    ]);
    push.mockClear();
    expect(await recordInbound(lead.id, inbound('wamid.in'))).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('applyStatus pushes forward moves only', async () => {
    const lead = await makeLead();
    await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'OUT',
        waMessageId: 'wamid.out',
        type: 'TEXT',
        body: { text: 'Hi' },
        status: 'SENT',
        sentBy: 'bot',
      },
    });
    const push = vi.spyOn(realtime, 'publish');
    await applyStatus({ waMessageId: 'wamid.out', status: 'READ' });
    expect(published(push)).toEqual([[`private-lead-${lead.id}`, 'message.status', 'READ']]);
    push.mockClear();
    await applyStatus({ waMessageId: 'wamid.out', status: 'DELIVERED' }); // late receipt
    expect(push).not.toHaveBeenCalled();
  });

  it('sends a stub instead of a row too big for Pusher', async () => {
    const lead = await makeLead();
    const push = vi.spyOn(realtime, 'publish');
    // 4096 Devanagari characters: legal for WhatsApp, about 12 KB in UTF-8.
    await recordInbound(lead.id, { ...inbound('wamid.big'), text: 'न'.repeat(4096) });
    expect(push.mock.calls[0][2]).toEqual({ refetch: true });
  });
});

describe.skipIf(!hasTestDb)('read receipts and typing', () => {
  const inboundRow = (leadId: string, waMessageId: string, createdAt: Date) =>
    db.message.create({
      data: {
        leadId,
        direction: 'IN',
        waMessageId,
        type: 'TEXT',
        body: { text: 'Hi' },
        status: 'DELIVERED',
        sentBy: 'lead',
        createdAt,
      },
    });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  it('acknowledges the latest inbound message', async () => {
    const lead = await makeLead();
    await inboundRow(lead.id, 'wamid.old', new Date(Date.now() - 60_000));
    await inboundRow(lead.id, 'wamid.new', new Date());
    const markRead = vi.spyOn(whatsapp, 'markRead').mockResolvedValue();
    await markInboundRead(lead.id);
    expect(markRead).toHaveBeenLastCalledWith('wamid.new', { typing: false });
    await showTyping(lead.id);
    expect(markRead).toHaveBeenLastCalledWith('wamid.new', { typing: true });
  });

  it('does nothing without an inbound message, or for an opted-out lead', async () => {
    const lead = await makeLead();
    const markRead = vi.spyOn(whatsapp, 'markRead').mockResolvedValue();
    await markInboundRead(lead.id);
    await inboundRow(lead.id, 'wamid.in', new Date());
    await db.lead.update({ where: { id: lead.id }, data: { optedOutAt: new Date() } });
    await showTyping(lead.id);
    expect(markRead).not.toHaveBeenCalled();
  });

  it('a failed receipt never rejects, so it can never stop a bot reply', async () => {
    const lead = await makeLead();
    await inboundRow(lead.id, 'wamid.in', new Date());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(whatsapp, 'markRead').mockRejectedValue(new WhatsAppApiError('boom'));
    await expect(showTyping(lead.id)).resolves.toBeUndefined();
  });
});
