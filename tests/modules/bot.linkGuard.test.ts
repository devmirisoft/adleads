import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { runJobsNow } from '@/app/_jobs/handlers';
import { assignSeat, sendTrialLink } from '@/modules/enrollments';
import { recordWebhook } from '@/modules/jobs';
import { buildMetaPayload, metaEventKey, type SimulatedInbound } from '@/modules/messaging';
import { markPaid, requestPayment, runTrialsCron } from '@/modules/payments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

// WhatsApp live, Zoom/Razorpay fake. The WhatsApp adapter itself stays fake, so nothing leaves.
vi.mock('@/lib/config', async (original) => ({
  ...(await original<typeof import('@/lib/config')>()),
  linksAreFake: () => true,
}));

const say = async (phoneE164: string, message: SimulatedInbound) => {
  const payload = buildMetaPayload({
    waId: phoneE164.slice(1),
    profileName: 'Rahul',
    message,
  }) as Prisma.InputJsonValue;
  await recordWebhook('META', metaEventKey(payload, JSON.stringify(payload)), payload);
  await runJobsNow();
};
const sentTo = (leadId: string) =>
  db.message
    .findMany({ where: { leadId, direction: 'OUT' }, orderBy: { createdAt: 'asc' } })
    .then((rows) => rows.map((m) => JSON.stringify(m.body)));

describe.skipIf(!hasTestDb)('fake Zoom/Razorpay behind live WhatsApp', () => {
  let ids: Awaited<ReturnType<typeof seedBasics>>;
  beforeEach(async () => {
    await resetDb();
    ids = await seedBasics({ capacity: 5 });
  });

  /** A staff-booked trial: the only way to one while the guard is on. */
  async function trial() {
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, ids.batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    return { lead, enrollmentId: res.enrollmentId };
  }

  it('the bot stops at confirm: no seat, no trial, no link, staff flagged', async () => {
    const PHONE = '+919812345678';
    await say(PHONE, { kind: 'text', text: 'Hi' });
    await say(PHONE, { kind: 'text', text: 'Rahul Sharma' });
    await say(PHONE, { kind: 'list', id: ids.course.id, title: 'Spoken English' });
    await say(PHONE, { kind: 'list', id: ids.batch.id, title: 'Evening Mon–Fri' });
    await say(PHONE, { kind: 'button', id: 'confirm', title: 'Confirm' });

    const lead = await db.lead.findUniqueOrThrow({ where: { phoneE164: PHONE } });
    expect(lead).toMatchObject({ status: 'QUALIFIED', needsHuman: true, currentStep: null });
    expect(await db.enrollment.count()).toBe(0);
    expect(await db.batch.findUniqueOrThrow({ where: { id: ids.batch.id } })).toMatchObject({
      seatsTaken: 0,
    });
    const sent = await sentTo(lead.id);
    expect(sent.at(-1)).toContain('Our team will send your class link shortly.');
    expect(sent.join()).not.toContain('https://');
  });

  it('a waitlisted lead asking for a seat is handed over too', async () => {
    const lead = await makeLead('WAITLISTED', { courseId: ids.course.id });
    await db.answer.create({
      data: {
        leadId: lead.id,
        questionKey: 'batch',
        answerValue: ids.batch.id,
        answerLabel: ids.batch.name,
      },
    });
    await say(lead.phoneE164, { kind: 'button', id: 'book_seat', title: 'Book my seat' });

    expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      status: 'WAITLISTED',
      needsHuman: true,
    });
    expect(await db.enrollment.count()).toBe(0);
    expect((await sentTo(lead.id)).at(-1)).toContain('Our team will send your class link shortly.');
  });

  it('a link already stored from fake mode is not given out', async () => {
    const { lead, enrollmentId } = await trial();
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { zoomJoinUrl: 'https://zoom.example/j/1?tk=stale' },
    });
    await say(lead.phoneE164, { kind: 'text', text: 'send me the zoom link' });

    expect((await sentTo(lead.id)).join()).not.toContain('zoom.example');
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(true);
  });

  it('staff actions and crons send no links', async () => {
    const { lead, enrollmentId } = await trial();
    await expect(sendTrialLink(enrollmentId)).rejects.toThrow("Zoom isn't live");
    await expect(requestPayment(enrollmentId, { actor: 'test' })).rejects.toThrow(
      "Razorpay isn't live",
    );
    await db.enrollment.update({ where: { id: enrollmentId }, data: { trialEnd: new Date() } }); // due now
    expect((await runTrialsCron()).paymentRequests).toEqual({ done: 0, failed: [] });

    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      zoomRegistrantId: null,
      zoomJoinUrl: null,
    });
    expect(await db.payment.count()).toBe(0);
    expect(await sentTo(lead.id)).toEqual([]);
  });

  it('a manual payment still enrolls, with no link, and flags staff', async () => {
    const { lead, enrollmentId } = await trial();
    const payment = await db.payment.create({
      data: { enrollmentId, amountPaise: 299_900, method: 'CASH', status: 'CREATED' },
    });
    expect(
      await markPaid({
        paymentId: payment.id,
        method: 'CASH',
        amountPaise: 299_900,
        actor: 'test',
      }),
    ).toBe('enrolled');

    expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      status: 'ENROLLED',
      needsHuman: true,
    });
    expect(await sentTo(lead.id)).toEqual([]);
  });
});
