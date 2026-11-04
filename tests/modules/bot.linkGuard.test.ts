import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { runJobsNow } from '@/app/_jobs/handlers';
import { assignSeat } from '@/modules/enrollments';
import { recordWebhook } from '@/modules/jobs';
import { buildMetaPayload, metaEventKey, type SimulatedInbound } from '@/modules/messaging';
import { expireDueTrials, markPaid, requestPayment, runTrialsCron } from '@/modules/payments';
import { db, hasTestDb, makeLead, PAID_LINK, resetDb, seedBasics, TRIAL_LINK } from '../helpers/db';

// WhatsApp live, Razorpay fake. The WhatsApp adapter itself stays fake, so nothing leaves.
vi.mock('@/lib/config', async (original) => ({
  ...(await original<typeof import('@/lib/config')>()),
  paymentLinksAreFake: () => true,
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
const leadRow = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });

const PHONE = '+919812345678';

describe.skipIf(!hasTestDb)('class links with fake payment links behind live WhatsApp', () => {
  /** Answer the whole script from "Hi" to Confirm. */
  async function finishScript(ids: Awaited<ReturnType<typeof seedBasics>>) {
    await say(PHONE, { kind: 'text', text: 'Hi' });
    await say(PHONE, { kind: 'text', text: 'Rahul Sharma' });
    await say(PHONE, { kind: 'list', id: ids.course.id, title: 'Spoken English' });
    await say(PHONE, { kind: 'list', id: ids.batch.id, title: 'Evening Mon–Fri' });
    await say(PHONE, { kind: 'button', id: 'confirm', title: 'Confirm' });
    return db.lead.findUniqueOrThrow({ where: { phoneE164: PHONE } });
  }

  async function waitlisted(ids: Awaited<ReturnType<typeof seedBasics>>) {
    const lead = await makeLead('WAITLISTED', { courseId: ids.course.id });
    await db.answer.create({
      data: {
        leadId: lead.id,
        questionKey: 'batch',
        answerValue: ids.batch.id,
        answerLabel: ids.batch.name,
      },
    });
    return lead;
  }

  /** A trial booked through the job queue, so the trial link has gone out and is stored. */
  async function trial(ids: Awaited<ReturnType<typeof seedBasics>>) {
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, ids.batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    await runJobsNow();
    return { lead, enrollmentId: res.enrollmentId };
  }

  describe('batch with both links', () => {
    let ids: Awaited<ReturnType<typeof seedBasics>>;
    beforeEach(async () => {
      await resetDb();
      ids = await seedBasics({ capacity: 5 });
    });

    it('finishing the script starts the trial and sends the trial link', async () => {
      const lead = await finishScript(ids);

      expect(lead).toMatchObject({ status: 'TRIAL_ACTIVE', needsHuman: false, currentStep: null });
      expect(await db.enrollment.findFirstOrThrow({ where: { leadId: lead.id } })).toMatchObject({
        status: 'TRIAL',
        zoomJoinUrl: TRIAL_LINK,
      });
      expect((await db.batch.findUniqueOrThrow({ where: { id: ids.batch.id } })).seatsTaken).toBe(
        1,
      );
      expect((await sentTo(lead.id)).at(-1)).toContain(TRIAL_LINK);
    });

    it('a waitlisted lead booking a free seat starts the trial too', async () => {
      const lead = await waitlisted(ids);
      await say(lead.phoneE164, { kind: 'button', id: 'book_seat', title: 'Book my seat' });

      expect((await leadRow(lead.id)).status).toBe('TRIAL_ACTIVE');
      expect((await sentTo(lead.id)).join()).toContain(TRIAL_LINK);
    });

    it('"send link" resends the stored trial link', async () => {
      const { lead } = await trial(ids);
      await say(lead.phoneE164, { kind: 'text', text: 'send me the zoom link' });

      expect((await sentTo(lead.id)).at(-1)).toContain(`Your class link: ${TRIAL_LINK}`);
      expect((await leadRow(lead.id)).needsHuman).toBe(false);
    });

    it('"send link" hands over when no link has gone out yet', async () => {
      const { lead, enrollmentId } = await trial(ids);
      await db.enrollment.update({ where: { id: enrollmentId }, data: { zoomJoinUrl: null } });
      await say(lead.phoneE164, { kind: 'text', text: 'send me the zoom link' });

      expect((await leadRow(lead.id)).needsHuman).toBe(true);
      expect((await sentTo(lead.id)).at(-1)).not.toContain('zoom.example');
    });

    it('"payment link" hands over: no Razorpay link and no class link in its place', async () => {
      const { lead, enrollmentId } = await trial(ids);
      await db.payment.create({
        data: {
          enrollmentId,
          amountPaise: 299_900,
          method: 'RAZORPAY',
          status: 'CREATED',
          razorpayLinkUrl: 'https://rzp.example/fake',
        },
      });
      await db.lead.update({ where: { id: lead.id }, data: { status: 'PAYMENT_PENDING' } });
      await say(lead.phoneE164, { kind: 'text', text: 'send the payment link' });

      expect((await leadRow(lead.id)).needsHuman).toBe(true);
      expect((await sentTo(lead.id)).at(-1)).not.toContain('https://');
    });

    it('a PAYMENT_PENDING lead asking for the class link still gets it, without the fake pay link', async () => {
      const { lead, enrollmentId } = await trial(ids);
      await db.payment.create({
        data: {
          enrollmentId,
          amountPaise: 299_900,
          method: 'RAZORPAY',
          status: 'CREATED',
          razorpayLinkUrl: 'https://rzp.example/fake',
        },
      });
      await db.lead.update({ where: { id: lead.id }, data: { status: 'PAYMENT_PENDING' } });
      await say(lead.phoneE164, { kind: 'text', text: 'send the class link' });

      const last = (await sentTo(lead.id)).at(-1);
      expect(last).toContain(TRIAL_LINK);
      expect(last).not.toContain('rzp.example');
    });

    it('requestPayment refuses; the cron skips payment steps but still reminds about classes', async () => {
      const { lead, enrollmentId } = await trial(ids);
      await expect(requestPayment(enrollmentId, { actor: 'test' })).rejects.toThrow(
        "Razorpay isn't live",
      );
      await db.enrollment.update({ where: { id: enrollmentId }, data: { trialEnd: new Date() } }); // due now
      const res = await runTrialsCron();

      expect(res.paymentRequests).toEqual({ done: 0, failed: [] });
      expect(res.lastDayReminders).toEqual({ done: 0, failed: [] });
      expect(await db.payment.count()).toBe(0);
      expect((await leadRow(lead.id)).status).toBe('TRIAL_ACTIVE');
    });

    it('class reminders go out in this mode', async () => {
      const { enrollmentId } = await trial(ids);
      // A class every day and a trial starting tomorrow: the first class is tomorrow, any weekday.
      await db.batch.update({
        where: { id: ids.batch.id },
        data: { daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
      });
      await db.enrollment.update({
        where: { id: enrollmentId },
        data: { trialStart: new Date(Date.now() + 86_400_000) },
      });

      expect((await runTrialsCron()).classReminders).toBe(1);
    });

    it('expireDueTrials expires a trial directly: flagged, seat freed, no payment link', async () => {
      const { lead, enrollmentId } = await trial(ids);
      await db.enrollment.update({ where: { id: enrollmentId }, data: { trialEnd: new Date() } });

      expect(await expireDueTrials()).toEqual({ done: 1, failed: [] });

      const after = await leadRow(lead.id);
      expect(after).toMatchObject({ status: 'EXPIRED', needsHuman: true });
      expect(after.notes).toContain('record a manual payment');
      expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
        status: 'EXPIRED',
        zoomJoinUrl: null,
      });
      expect((await db.batch.findUniqueOrThrow({ where: { id: ids.batch.id } })).seatsTaken).toBe(
        0,
      );
      expect(await db.payment.count()).toBe(0);
      expect(
        await db.leadEvent.count({
          where: { leadId: lead.id, fromStatus: 'TRIAL_ACTIVE', toStatus: 'EXPIRED' },
        }),
      ).toBe(1);
    });

    it('a manual payment enrolls and sends the paid link', async () => {
      const { lead, enrollmentId } = await trial(ids);
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
      await runJobsNow();

      expect((await leadRow(lead.id)).status).toBe('ENROLLED');
      expect((await sentTo(lead.id)).at(-1)).toContain(PAID_LINK);

      // And once paid, "send link" gives the paid link, not the trial one.
      await say(lead.phoneE164, { kind: 'text', text: 'send me the link' });
      const last = (await sentTo(lead.id)).at(-1);
      expect(last).toContain(PAID_LINK);
      expect(last).not.toContain(TRIAL_LINK);
    });
  });

  describe('batch with no links', () => {
    let ids: Awaited<ReturnType<typeof seedBasics>>;
    beforeEach(async () => {
      await resetDb();
      ids = await seedBasics({ capacity: 5, links: false });
    });

    it('finishing the script stops at QUALIFIED: no seat, flagged, holding message', async () => {
      const lead = await finishScript(ids);

      expect(lead).toMatchObject({ status: 'QUALIFIED', needsHuman: true, currentStep: null });
      expect(await db.enrollment.count()).toBe(0);
      expect((await db.batch.findUniqueOrThrow({ where: { id: ids.batch.id } })).seatsTaken).toBe(
        0,
      );
      const sent = await sentTo(lead.id);
      expect(sent.at(-1)).toContain('Our team will send your class link shortly.');
      expect(sent.join()).not.toContain('https://');
    });

    it('a waitlisted lead asking for a seat stays waitlisted, flagged, holding message', async () => {
      const lead = await waitlisted(ids);
      await say(lead.phoneE164, { kind: 'button', id: 'book_seat', title: 'Book my seat' });

      expect(await leadRow(lead.id)).toMatchObject({ status: 'WAITLISTED', needsHuman: true });
      expect(await db.enrollment.count()).toBe(0);
      expect((await sentTo(lead.id)).at(-1)).toContain(
        'Our team will send your class link shortly.',
      );
    });
  });
});
