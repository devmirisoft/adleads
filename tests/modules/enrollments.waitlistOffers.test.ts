import { beforeEach, describe, expect, it } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { runJobsNow } from '@/app/_jobs/handlers';
import { setDevNowOffsetDays } from '@/lib/clock';
import { closeBatch, createBatch, updateBatch } from '@/modules/batches';
import {
  assignSeat,
  bookableBatches,
  cancel,
  currentOffer,
  expire,
  listableCourses,
  listOpenBatches,
  moveBatch,
  offerSeat,
  runWaitlistOffers,
} from '@/modules/enrollments';
import { recordWebhook } from '@/modules/jobs';
import { countInbox } from '@/modules/leads';
import { buildMetaPayload, metaEventKey, type SimulatedInbound } from '@/modules/messaging';
import { db, hasTestDb, makeLead, resetDb, seedBasics, TRIAL_LINK } from '../helpers/db';

const say = async (phoneE164: string, message: SimulatedInbound) => {
  const payload = buildMetaPayload({
    waId: phoneE164.slice(1),
    profileName: 'Rahul',
    message,
  }) as Prisma.InputJsonValue;
  await recordWebhook('META', metaEventKey(payload, JSON.stringify(payload)), payload);
  await runJobsNow();
};
const BOOK: SimulatedInbound = { kind: 'button', id: 'book_seat', title: 'Book my seat' };

const lastText = async (leadId: string) => {
  const m = await db.message.findFirst({
    where: { leadId, direction: 'OUT' },
    orderBy: { createdAt: 'desc' },
  });
  return JSON.stringify(m?.body);
};
const pending = () =>
  db.waitlistOffer.findMany({ where: { status: 'PENDING' }, orderBy: { offeredAt: 'asc' } });
const offerStatus = async (leadId: string) =>
  (await db.waitlistOffer.findFirstOrThrow({ where: { leadId }, orderBy: { offeredAt: 'desc' } }))
    .status;
const batchRow = (id: string) => db.batch.findUniqueOrThrow({ where: { id } });
const leadRow = (id: string) => db.lead.findUniqueOrThrow({ where: { id } });
const offerJobs = () =>
  db.job
    .findMany({ where: { type: 'sendMessage' }, orderBy: { id: 'asc' } })
    .then((jobs) => jobs.map((j) => j.payload as { leadId: string; template: string }))
    .then((all) => all.filter((p) => p.template === 'waitlist_seat_open'));

/** Waitlisted leads on a course, oldest first. */
async function waiters(courseId: string, count: number) {
  const leads = [];
  for (let i = 0; i < count; i++) leads.push(await makeLead('WAITLISTED', { courseId }));
  return leads;
}

/** A trial holding one seat, for tests that need the batch partly full. */
async function trialIn(batchId: string) {
  const lead = await makeLead('QUALIFIED');
  const res = await assignSeat(lead.id, batchId, { actor: 'test' });
  if (res.result !== 'trial') throw new Error('expected a seat');
  return { lead, enrollmentId: res.enrollmentId };
}

const batchInput = (courseId: string, capacity: number, host = 'host@zoom.example') => ({
  courseId,
  name: 'Evening Mon–Fri',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '19:00',
  endTime: '20:00',
  startDate: '2026-01-01',
  endDate: '2099-12-31',
  capacity,
  zoomHostUser: host,
  trialLink: TRIAL_LINK,
  paidLink: '',
});

describe.skipIf(!hasTestDb)('waitlist offers', () => {
  beforeEach(resetDb);

  describe('multiple available seats', () => {
    it('offers one lead per free seat, oldest first, and a re-run changes nothing', async () => {
      const { course, batch } = await seedBasics({ capacity: 3 });
      const leads = await waiters(course.id, 4);

      expect(await runWaitlistOffers()).toMatchObject({ offered: 3, failed: [] });

      expect((await pending()).map((o) => o.leadId).sort()).toEqual(
        leads
          .slice(0, 3)
          .map((l) => l.id)
          .sort(),
      );
      expect((await pending()).every((o) => o.batchId === batch.id)).toBe(true);
      expect((await offerJobs()).map((j) => j.leadId).sort()).toEqual(
        leads
          .slice(0, 3)
          .map((l) => l.id)
          .sort(),
      );

      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });
      expect(await offerJobs()).toHaveLength(3);
    });

    it('takes seats already filled and already on offer off the count', async () => {
      const { course, batch } = await seedBasics({ capacity: 3 });
      await trialIn(batch.id);
      const [a, b] = await waiters(course.id, 2);
      await offerSeat(a.id, batch.id, { actor: 'staff' });
      const [c] = await waiters(course.id, 1);

      expect(await runWaitlistOffers()).toMatchObject({ offered: 1 });

      expect((await pending()).map((o) => o.leadId).sort()).toEqual([a.id, b.id].sort());
      expect(await db.waitlistOffer.count({ where: { leadId: c.id } })).toBe(0);
    });

    it('every lead holding an offer can book their seat', async () => {
      const { course, batch } = await seedBasics({ capacity: 2 });
      const [a, b] = await waiters(course.id, 2);
      await runWaitlistOffers();

      await say(a.phoneE164, BOOK);
      await say(b.phoneE164, BOOK);

      for (const lead of [a, b]) {
        expect((await leadRow(lead.id)).status).toBe('TRIAL_ACTIVE');
        expect(await offerStatus(lead.id)).toBe('ACCEPTED');
      }
      expect(await batchRow(batch.id)).toMatchObject({ seatsTaken: 2, status: 'FULL' });
    });
  });

  describe('a held seat', () => {
    it('is free to nobody else: bot list, staff picker, course label and booking agree', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [holder] = await waiters(course.id, 1);
      await runWaitlistOffers();

      expect(await bookableBatches(course.id)).toEqual([]);
      expect((await listableCourses())[0]).toMatchObject({ id: course.id, waitlistOnly: true });
      expect(await listOpenBatches()).toEqual([]);
      expect((await listOpenBatches(holder.id)).map((b) => b.id)).toEqual([batch.id]);

      const stranger = await makeLead('QUALIFIED');
      expect((await assignSeat(stranger.id, batch.id, { actor: 'test' })).result).toBe(
        'waitlisted',
      );
      expect((await leadRow(stranger.id)).status).toBe('WAITLISTED');
      expect((await batchRow(batch.id)).seatsTaken).toBe(0);
    });

    it('cannot be taken by moving another enrollment into the batch', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      await waiters(course.id, 1);
      await runWaitlistOffers();
      const other = await db.batch.create({
        data: {
          courseId: course.id,
          name: 'Morning',
          daysOfWeek: [1],
          startTime: '08:00',
          endTime: '09:00',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2099-12-31'),
          capacity: 1,
          trialLink: TRIAL_LINK,
        },
      });
      const { enrollmentId } = await trialIn(other.id);

      await expect(moveBatch(enrollmentId, batch.id)).rejects.toThrow('no free seats');
    });

    it('is released as soon as the lead opts out', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [holder, next] = await waiters(course.id, 2);
      await runWaitlistOffers();
      expect(await bookableBatches(course.id)).toEqual([]);

      await say(holder.phoneE164, { kind: 'text', text: 'STOP' });

      expect((await bookableBatches(course.id)).map((b) => b.id)).toEqual([batch.id]);
      expect(await runWaitlistOffers()).toMatchObject({ cancelled: 1, offered: 1 });
      expect(await offerStatus(holder.id)).toBe('CANCELLED');
      expect((await pending()).map((o) => o.leadId)).toEqual([next.id]);
    });
  });

  describe('rotation', () => {
    it('goes through never-offered leads first, then back to the longest since an offer', async () => {
      const { course } = await seedBasics({ capacity: 1 });
      const [a, b, c] = await waiters(course.id, 3);
      const holder = async () => (await pending()).map((o) => o.leadId);

      await runWaitlistOffers();
      expect(await holder()).toEqual([a.id]);

      await setDevNowOffsetDays(1);
      expect(await runWaitlistOffers()).toMatchObject({ expired: 1, offered: 1 });
      expect(await holder()).toEqual([b.id]);
      expect(await offerStatus(a.id)).toBe('EXPIRED');

      await setDevNowOffsetDays(2);
      await runWaitlistOffers();
      expect(await holder()).toEqual([c.id]);

      await setDevNowOffsetDays(3);
      await runWaitlistOffers();
      expect(await holder()).toEqual([a.id]);
    });

    it('a new lead goes ahead of one who already had an offer', async () => {
      const { course } = await seedBasics({ capacity: 1 });
      const [old] = await waiters(course.id, 1);
      await runWaitlistOffers();
      const [fresh] = await waiters(course.id, 1);

      await setDevNowOffsetDays(1);
      await runWaitlistOffers();

      expect((await pending()).map((o) => o.leadId)).toEqual([fresh.id]);
      expect(await offerStatus(old.id)).toBe('EXPIRED');
    });

    it('never offers one lead twice within 24 hours, even with seats free', async () => {
      const { course } = await seedBasics({ capacity: 5 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();
      await db.waitlistOffer.updateMany({ data: { status: 'CANCELLED' } });

      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });

      await setDevNowOffsetDays(1);
      expect(await runWaitlistOffers()).toMatchObject({ offered: 1 });
      expect((await pending()).map((o) => o.leadId)).toEqual([lead.id]);
    });
  });

  describe('expired offers', () => {
    it('stop holding the seat at once, before the sweep marks them', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();
      expect(await bookableBatches(course.id)).toEqual([]);

      await setDevNowOffsetDays(1);

      expect((await bookableBatches(course.id)).map((b) => b.id)).toEqual([batch.id]);
      expect(await currentOffer(lead.id)).toBeNull();
    });

    it('a late tap books nothing, flags staff and tells the lead plainly', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();
      await db.lead.update({ where: { id: lead.id }, data: { needsHuman: false } });

      await setDevNowOffsetDays(1);
      await say(lead.phoneE164, BOOK);

      expect(await leadRow(lead.id)).toMatchObject({ status: 'WAITLISTED', needsHuman: true });
      expect(await db.enrollment.count()).toBe(0);
      expect((await batchRow(batch.id)).seatsTaken).toBe(0);
      expect(await lastText(lead.id)).toContain("we don't have a seat held for you");
    });

    it('a waitlisted lead with no offer cannot book by typing yes', async () => {
      const { course, batch } = await seedBasics({ capacity: 3 });
      const [lead] = await waiters(course.id, 1);
      await db.answer.create({
        data: {
          leadId: lead.id,
          questionKey: 'batch',
          answerValue: batch.id,
          answerLabel: batch.name,
        },
      });

      await say(lead.phoneE164, { kind: 'text', text: 'yes' });

      expect((await leadRow(lead.id)).status).toBe('WAITLISTED');
      expect(await db.enrollment.count()).toBe(0);
    });
  });

  describe('closed and ended batches', () => {
    const ended = { endDate: new Date('2020-01-01') };
    const cases = [
      ['closed', { status: 'CLOSED' as const }],
      ['ended', ended],
    ] as const;

    it.each(cases)('a batch that is %s is never offered', async (_name, change) => {
      const { course, batch } = await seedBasics({ capacity: 5 });
      const [lead] = await waiters(course.id, 1);
      await db.batch.update({ where: { id: batch.id }, data: change });

      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });
      await expect(offerSeat(lead.id, batch.id, { actor: 'staff' })).rejects.toThrow(
        'closed or ended',
      );
      expect(await offerJobs()).toEqual([]);
    });

    it.each(cases)(
      'a %s batch cannot be booked, even with an open offer',
      async (_name, change) => {
        const { course, batch } = await seedBasics({ capacity: 5 });
        const [lead] = await waiters(course.id, 1);
        await runWaitlistOffers();
        await db.batch.update({ where: { id: batch.id }, data: change });

        await say(lead.phoneE164, BOOK);

        expect((await leadRow(lead.id)).status).toBe('WAITLISTED');
        expect(await db.enrollment.count()).toBe(0);
        expect(await lastText(lead.id)).toContain('no available seats');
      },
    );

    it.each(cases)('a new lead is refused a batch that is %s', async (_name, change) => {
      const { batch } = await seedBasics({ capacity: 5 });
      await db.batch.update({ where: { id: batch.id }, data: change });
      const lead = await makeLead('QUALIFIED');

      expect((await assignSeat(lead.id, batch.id, { actor: 'test' })).result).toBe('waitlisted');
    });

    it('closing a batch ends its open offers on the next sweep', async () => {
      const { course, batch } = await seedBasics({ capacity: 5 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();

      await closeBatch(batch.id);

      expect(await runWaitlistOffers()).toMatchObject({ cancelled: 1, offered: 0 });
      expect(await offerStatus(lead.id)).toBe('CANCELLED');
    });

    it('a trial expiring in a closed batch does not offer its seat', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const { enrollmentId } = await trialIn(batch.id);
      await waiters(course.id, 1);
      await closeBatch(batch.id);

      await expire(enrollmentId, { actor: 'cron' });

      expect(await batchRow(batch.id)).toMatchObject({ seatsTaken: 0, status: 'CLOSED' });
      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });
      expect(await offerJobs()).toEqual([]);
    });
  });

  describe('a batch with no trial link', () => {
    it('alerts staff once instead of sending an unusable offer, then offers when it gets one', async () => {
      const { course, batch } = await seedBasics({ capacity: 2, links: false });
      const [lead] = await waiters(course.id, 1);

      expect(await runWaitlistOffers()).toMatchObject({ offered: 0, flagged: 1 });

      expect(await offerJobs()).toEqual([]);
      const flagged = await leadRow(lead.id);
      expect(flagged.needsHuman).toBe(true);
      expect(flagged.notes).toContain('no trial link');
      expect(await countInbox()).toBe(1);

      // Staff dealt with it: the next sweep doesn't drag the lead back into the inbox.
      await db.lead.update({ where: { id: lead.id }, data: { needsHuman: false } });
      expect(await runWaitlistOffers()).toMatchObject({ flagged: 0 });
      expect((await leadRow(lead.id)).needsHuman).toBe(false);

      await db.batch.update({ where: { id: batch.id }, data: { trialLink: TRIAL_LINK } });
      expect(await runWaitlistOffers()).toMatchObject({ offered: 1 });
    });

    it('cannot be offered by hand', async () => {
      const { course, batch } = await seedBasics({ capacity: 2, links: false });
      const [lead] = await waiters(course.id, 1);

      await expect(offerSeat(lead.id, batch.id, { actor: 'staff' })).rejects.toThrow(
        'no trial link',
      );
      expect((await listOpenBatches())[0]).toMatchObject({ id: batch.id, hasTrialLink: false });
    });
  });

  describe('every way a seat appears', () => {
    it('a cancellation', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const { enrollmentId } = await trialIn(batch.id);
      const [lead] = await waiters(course.id, 1);
      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });

      await cancel(enrollmentId, 'staff', { actor: 'test' });

      expect(await runWaitlistOffers()).toMatchObject({ offered: 1 });
      expect((await pending())[0].leadId).toBe(lead.id);
    });

    it('a capacity increase', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      await trialIn(batch.id);
      await waiters(course.id, 3);
      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });

      await updateBatch(batch.id, batchInput(course.id, 3));

      expect(await runWaitlistOffers()).toMatchObject({ offered: 2 });
    });

    it('a new batch, reaching a lead whose old batch answer is a different batch', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      await trialIn(batch.id);
      const [lead] = await waiters(course.id, 1);
      await db.answer.create({
        data: {
          leadId: lead.id,
          questionKey: 'batch',
          answerValue: batch.id,
          answerLabel: batch.name,
        },
      });

      const added = await createBatch({
        ...batchInput(course.id, 2, 'other@zoom.example'),
        name: 'New evening',
      });

      expect(await runWaitlistOffers()).toMatchObject({ offered: 1 });
      expect(await pending()).toMatchObject([{ leadId: lead.id, batchId: added.id }]);
    });

    it('nothing is offered on a course that was switched off', async () => {
      const { course } = await seedBasics({ capacity: 1 });
      await waiters(course.id, 1);
      await db.course.update({ where: { id: course.id }, data: { isActive: false } });

      expect(await runWaitlistOffers()).toMatchObject({ offered: 0 });
    });
  });

  describe('needsHuman', () => {
    it('is set whichever way a lead becomes waitlisted, and cleared when they book', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      await trialIn(batch.id);
      const lead = await makeLead('QUALIFIED', { courseId: course.id });

      await assignSeat(lead.id, batch.id, { actor: 'test' });
      expect(await leadRow(lead.id)).toMatchObject({ status: 'WAITLISTED', needsHuman: true });

      await db.batch.update({ where: { id: batch.id }, data: { capacity: 2, status: 'OPEN' } });
      await runWaitlistOffers();
      await say(lead.phoneE164, BOOK);
      expect(await leadRow(lead.id)).toMatchObject({ status: 'TRIAL_ACTIVE', needsHuman: false });
    });

    it('is cleared when staff assign a waitlisted lead a seat directly', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const lead = await makeLead('WAITLISTED', { courseId: course.id });
      await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });

      await assignSeat(lead.id, batch.id, { actor: 'staff' });

      expect(await leadRow(lead.id)).toMatchObject({ status: 'TRIAL_ACTIVE', needsHuman: false });
    });

    it('stays set for a lead who asked for help before booking through the bot', async () => {
      const { batch } = await seedBasics({ capacity: 1 });
      const lead = await makeLead('QUALIFIED');
      await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });

      await assignSeat(lead.id, batch.id, { actor: 'bot' });

      expect(await leadRow(lead.id)).toMatchObject({ status: 'TRIAL_ACTIVE', needsHuman: true });
    });
  });

  describe('offering by hand', () => {
    it('works with no batch answer, and the lead books exactly that batch', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [lead] = await waiters(course.id, 1);

      await offerSeat(lead.id, batch.id, { actor: 'staff-1' });

      expect(await pending()).toMatchObject([
        { leadId: lead.id, batchId: batch.id, offeredBy: 'staff-1' },
      ]);
      expect(await offerJobs()).toHaveLength(1);

      await say(lead.phoneE164, BOOK);

      expect((await leadRow(lead.id)).status).toBe('TRIAL_ACTIVE');
      expect(await db.enrollment.findFirstOrThrow()).toMatchObject({ batchId: batch.id });
      expect(await lastText(lead.id)).toContain(TRIAL_LINK);
    });

    it('replaces an offer the lead already holds, and ignores the cooldown', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();
      const first = (await pending())[0];

      await offerSeat(lead.id, batch.id, { actor: 'staff' });

      expect((await pending()).map((o) => o.id)).not.toContain(first.id);
      expect(await pending()).toHaveLength(1);
      expect((await db.waitlistOffer.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(
        'CANCELLED',
      );
    });

    it("refuses a seat someone else holds, keeping the lead's existing offer", async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [holder, other] = await waiters(course.id, 2);
      await runWaitlistOffers();

      await expect(offerSeat(other.id, batch.id, { actor: 'staff' })).rejects.toThrow(
        'no free seats',
      );

      expect((await pending()).map((o) => o.leadId)).toEqual([holder.id]);
    });

    it('refuses a lead who is not waitlisted', async () => {
      const { batch } = await seedBasics({ capacity: 1 });
      const lead = await makeLead('QUALIFIED');

      await expect(offerSeat(lead.id, batch.id, { actor: 'staff' })).rejects.toThrow(
        'Only waitlisted leads',
      );
    });
  });

  describe('concurrency', () => {
    it('sweeps running together hand out a seat only once', async () => {
      const { course } = await seedBasics({ capacity: 1 });
      await waiters(course.id, 3);

      await Promise.all([runWaitlistOffers(), runWaitlistOffers(), runWaitlistOffers()]);

      expect(await pending()).toHaveLength(1);
      expect(await offerJobs()).toHaveLength(1);
    });

    it('sweeps running together give out each of several seats once', async () => {
      const { course } = await seedBasics({ capacity: 3 });
      await waiters(course.id, 6);

      await Promise.all(Array.from({ length: 4 }, () => runWaitlistOffers()));

      const offers = await pending();
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.leadId)).size).toBe(3);
      expect(await offerJobs()).toHaveLength(3);
    });

    it('one lead never holds seats in two batches, even if both are offered at once', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      await db.batch.create({
        data: {
          courseId: course.id,
          name: 'Morning',
          daysOfWeek: [1],
          startTime: '08:00',
          endTime: '09:00',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2099-12-31'),
          capacity: 1,
          trialLink: TRIAL_LINK,
        },
      });
      const [lead] = await waiters(course.id, 1);

      await Promise.all([runWaitlistOffers(), runWaitlistOffers(), runWaitlistOffers()]);

      expect((await pending()).map((o) => o.leadId)).toEqual([lead.id]);
      expect(await batchRow(batch.id)).toMatchObject({ seatsTaken: 0 });
    });

    it('the database itself refuses a second pending offer for a lead', async () => {
      const { course, batch } = await seedBasics({ capacity: 5 });
      const [lead] = await waiters(course.id, 1);
      const data = {
        leadId: lead.id,
        batchId: batch.id,
        offeredBy: 'test',
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      };
      await db.waitlistOffer.create({ data });

      await expect(db.waitlistOffer.create({ data })).rejects.toThrow();
    });

    it('a holder booking against strangers always gets the held seat', async () => {
      const { course, batch } = await seedBasics({ capacity: 1 });
      const [holder] = await waiters(course.id, 1);
      await runWaitlistOffers();
      const strangers = await Promise.all(
        Array.from({ length: 5 }, () => makeLead('QUALIFIED', { courseId: course.id })),
      );

      const results = await Promise.all([
        ...strangers.map((s) => assignSeat(s.id, batch.id, { actor: 'test' })),
        assignSeat(holder.id, batch.id, { actor: 'bot' }),
      ]);

      expect(results.filter((r) => r.result === 'trial')).toHaveLength(1);
      expect((await leadRow(holder.id)).status).toBe('TRIAL_ACTIVE');
      expect(await batchRow(batch.id)).toMatchObject({ seatsTaken: 1, status: 'FULL' });
    });

    it('holders booking together never oversell when capacity was cut below the offers', async () => {
      const { course, batch } = await seedBasics({ capacity: 3 });
      const leads = await waiters(course.id, 3);
      await runWaitlistOffers();
      await db.batch.update({ where: { id: batch.id }, data: { capacity: 1 } });

      const results = await Promise.all(
        leads.map((l) => assignSeat(l.id, batch.id, { actor: 'bot' })),
      );

      expect(results.filter((r) => r.result === 'trial')).toHaveLength(1);
      expect(await batchRow(batch.id)).toMatchObject({ seatsTaken: 1 });
    });

    it('a double tap books one seat', async () => {
      const { course, batch } = await seedBasics({ capacity: 2 });
      const [lead] = await waiters(course.id, 1);
      await runWaitlistOffers();

      await Promise.allSettled([
        assignSeat(lead.id, batch.id, { actor: 'bot' }),
        assignSeat(lead.id, batch.id, { actor: 'bot' }),
      ]);

      expect((await batchRow(batch.id)).seatsTaken).toBe(1);
      expect(await db.enrollment.count()).toBe(1);
    });

    it('a sweep racing new bookings never promises more seats than exist', async () => {
      const { course, batch } = await seedBasics({ capacity: 2 });
      await waiters(course.id, 3);
      const strangers = await Promise.all(
        Array.from({ length: 3 }, () => makeLead('QUALIFIED', { courseId: course.id })),
      );

      await Promise.all([
        runWaitlistOffers(),
        ...strangers.map((s) => assignSeat(s.id, batch.id, { actor: 'test' })),
        runWaitlistOffers(),
      ]);

      const { seatsTaken, capacity } = await batchRow(batch.id);
      expect(seatsTaken + (await pending()).length).toBeLessThanOrEqual(capacity);
    });
  });
});
