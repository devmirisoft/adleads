import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { runJobsNow } from '@/app/_jobs/handlers';
import { recordWebhook } from '@/modules/jobs';
import {
  buildMetaPayload,
  metaEventKey,
  sendText,
  type MessageBody,
  type SimulatedInbound,
} from '@/modules/messaging';
import { db, hasTestDb, resetDb, seedBasics } from '../helpers/db';

// Replays WhatsApp webhooks through the real pipeline: store event → processWebhook job → bot.
const WA = '919812345678'; // the sender in tests/fixtures/meta/text_with_referral.json
const PHONE = `+${WA}`;
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/meta/${name}.json`, import.meta.url), 'utf8'),
  ) as Prisma.InputJsonValue;

async function deliver(payload: Prisma.InputJsonValue) {
  await recordWebhook('META', metaEventKey(payload, JSON.stringify(payload)), payload);
  const { failed } = await runJobsNow();
  expect(failed).toEqual([]);
}
const say = (message: SimulatedInbound) =>
  deliver(buildMetaPayload({ waId: WA, profileName: 'Rahul', message }) as Prisma.InputJsonValue);
const lead = () => db.lead.findUniqueOrThrow({ where: { phoneE164: PHONE } });
const lastOut = async () => {
  const m = await db.message.findFirst({
    where: { lead: { phoneE164: PHONE }, direction: 'OUT' },
    orderBy: { createdAt: 'desc' },
  });
  return (m?.body ?? {}) as MessageBody;
};
const outCount = () =>
  db.message.count({ where: { lead: { phoneE164: PHONE }, direction: 'OUT' } });

/** Hi (from an ad) → valid name → course list. */
async function startAndName() {
  await deliver(fixture('text_with_referral'));
  await say({ kind: 'text', text: 'Rahul Sharma' });
}

describe.skipIf(!hasTestDb)('bot engine', () => {
  let ids: Awaited<ReturnType<typeof seedBasics>>;
  beforeEach(async () => {
    await resetDb();
    ids = await seedBasics({ capacity: 5 });
  });

  it('happy path: Hi → name → course → batch → Confirm → trial link', async () => {
    await deliver(fixture('text_with_referral'));
    let l = await lead();
    expect(l).toMatchObject({
      status: 'ASKING',
      source: 'CTWA_AD',
      adId: '120210000000001',
      currentStep: 1,
    });
    expect((await lastOut()).text).toContain("What's your full name?");

    // Same webhook redelivered: stored once, no second reply.
    const n = await outCount();
    await deliver(fixture('text_with_referral'));
    expect(await outCount()).toBe(n);

    await say({ kind: 'text', text: 'Rahul Sharma' });
    expect((await lastOut()).rows?.map((r) => r.id)).toEqual([ids.course.id]);

    await say({ kind: 'list', id: ids.course.id, title: 'Spoken English' });
    expect((await lastOut()).rows).toEqual([
      {
        id: ids.batch.id,
        title: 'Evening Mon–Fri',
        description: 'Mon–Fri · 7:00 PM · 5 seats left',
      },
    ]);

    await say({ kind: 'list', id: ids.batch.id, title: 'Evening Mon–Fri' });
    expect((await lastOut()).buttons?.map((b) => b.id)).toEqual(['confirm', 'change']);

    await say({ kind: 'button', id: 'confirm', title: 'Confirm' });
    l = await lead();
    expect(l).toMatchObject({ status: 'TRIAL_ACTIVE', name: 'Rahul Sharma', currentStep: null });
    const e = await db.enrollment.findFirstOrThrow({ where: { leadId: l.id } });
    expect(e.zoomJoinUrl).toMatch(/^https:\/\/zoom\.example\/j\/81000000002\?tk=/);
    expect((await lastOut()).text).toContain(e.zoomJoinUrl!);
    const answers = await db.answer.findMany({ where: { leadId: l.id } });
    expect(answers.map((a) => a.questionKey).sort()).toEqual(['batch', 'course', 'name']);
  });

  it('two senders in one batch become two separate leads and threads', async () => {
    await deliver(fixture('multi_entry'));
    const leads = await db.lead.findMany({
      include: { messages: { where: { direction: 'IN' } } },
      orderBy: { phoneE164: 'asc' },
    });
    expect(leads.map((l) => [l.phoneE164, l.messages.length])).toEqual([
      ['+919810000001', 1],
      ['+919810000002', 1],
    ]);
  });

  it('events with nothing to do are processed with a note and never retried', async () => {
    await deliver({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'calls', value: { calls: [{ id: 'c1' }] } }] }],
    });
    await deliver({ object: 'page', entry: [] });
    const events = await db.webhookEvent.findMany({ orderBy: { id: 'asc' } });
    expect(events.map((e) => [!!e.processedAt, e.error])).toEqual([
      [true, 'Ignored field: calls'],
      [true, 'Not a WhatsApp Business webhook'],
    ]);
    expect(await db.job.count({ where: { status: { not: 'DONE' } } })).toBe(0);
  });

  it('a failed send keeps the reason on the message and puts the lead in the inbox', async () => {
    await deliver(fixture('text_with_referral'));
    const { id } = await lead();
    expect((await lead()).needsHuman).toBe(false);

    // Rejected on the way out (the fake enforces Meta's limits).
    await expect(sendText(id, 'x'.repeat(5000), { sentBy: 'bot' })).rejects.toThrow();
    const failed = await db.message.findFirstOrThrow({ where: { leadId: id, status: 'FAILED' } });
    expect(failed.errorCode).toContain('WhatsAppLimitError');
    expect((await lead()).needsHuman).toBe(true);

    // Rejected later, by a delivery receipt.
    await db.lead.update({ where: { id }, data: { needsHuman: false } });
    const sent = await db.message.findFirstOrThrow({ where: { leadId: id, status: 'SENT' } });
    await deliver({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [
                  {
                    id: sent.waMessageId,
                    status: 'failed',
                    errors: [{ code: 131026, title: 'Message undeliverable' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(await db.message.findUniqueOrThrow({ where: { id: sent.id } })).toMatchObject({
      status: 'FAILED',
      errorCode: '131026: Message undeliverable',
    });
    expect((await lead()).needsHuman).toBe(true);
  });

  it('invalid name: hint first, then hands over to a human', async () => {
    await deliver(fixture('text_with_referral'));
    await say({ kind: 'text', text: 'x' });
    const hint = await lastOut();
    expect(hint.text).toMatch(/^Please reply with just your full name/);
    expect(hint.retryStep).toBe(1);
    expect((await lead()).needsHuman).toBe(false);

    await say({ kind: 'text', text: '12345' });
    expect((await lead()).needsHuman).toBe(true);
    expect((await lastOut()).text).toContain('Someone from our team will reply');

    // A valid name still continues the script.
    await say({ kind: 'text', text: 'Rahul Sharma' });
    expect((await lastOut()).button).toBe('Choose course');
  });

  it('Change at confirm loops back to the course list', async () => {
    await startAndName();
    await say({ kind: 'list', id: ids.course.id, title: 'Spoken English' });
    await say({ kind: 'list', id: ids.batch.id, title: 'Evening Mon–Fri' });
    await say({ kind: 'button', id: 'change', title: 'Change' });
    expect((await lastOut()).button).toBe('Choose course');
    expect((await lead()).currentStep).toBe(2);

    await say({ kind: 'list', id: ids.course.id, title: 'Spoken English' });
    await say({ kind: 'list', id: ids.batch.id, title: 'Evening Mon–Fri' });
    await say({ kind: 'button', id: 'confirm', title: 'Confirm' });
    expect((await lead()).status).toBe('TRIAL_ACTIVE');
  });

  it('STOP opts out and the bot goes silent', async () => {
    await startAndName();
    await say({ kind: 'text', text: 'STOP' });
    const l = await lead();
    expect(l.status).toBe('OPTED_OUT');
    expect(l.optedOutAt).not.toBeNull();
    const n = await outCount();
    await say({ kind: 'text', text: 'Hi again' });
    expect(await outCount()).toBe(n);
    expect(await db.message.count({ where: { leadId: l.id, direction: 'IN' } })).toBe(4); // still logged
  });

  it('no free batch → WAITLISTED with a waitlist message', async () => {
    await db.batch.update({ where: { id: ids.batch.id }, data: { status: 'CLOSED' } });
    await startAndName();
    await say({ kind: 'list', id: ids.course.id, title: 'Spoken English' });
    const l = await lead();
    expect(l.status).toBe('WAITLISTED');
    expect((await lastOut()).text).toContain("You're on the waitlist");
    const trail = await db.leadEvent.findMany({ where: { leadId: l.id }, orderBy: { id: 'asc' } });
    expect(trail.map((e) => e.toStatus)).toEqual(['NEW', 'ASKING', 'QUALIFIED', 'WAITLISTED']);
  });
});
