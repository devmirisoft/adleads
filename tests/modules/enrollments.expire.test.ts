import { beforeEach, describe, expect, it } from 'vitest';
import { assignSeat, expire, sendTrialLink } from '@/modules/enrollments';
import { requestPayment } from '@/modules/payments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

describe.skipIf(!hasTestDb)('expire()', () => {
  beforeEach(resetDb);

  it('frees the seat, sends trial_ended and offers the seat to the waitlist', async () => {
    const { batch, course } = await seedBasics({ capacity: 1 });
    const trialLead = await makeLead('QUALIFIED');
    const res = await assignSeat(trialLead.id, batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    await sendTrialLink(res.enrollmentId);
    await requestPayment(res.enrollmentId, { actor: 'test' }); // → PAYMENT_PENDING

    // Batch is full → two later leads are waitlisted for it; the older one should get the offer.
    const first = await makeLead('QUALIFIED', { courseId: course.id, name: 'First Waiter' });
    const second = await makeLead('QUALIFIED', { courseId: course.id, name: 'Second Waiter' });
    for (const w of [first, second]) {
      expect((await assignSeat(w.id, batch.id, { actor: 'test' })).result).toBe('waitlisted');
      await db.answer.create({
        data: {
          leadId: w.id,
          questionKey: 'batch',
          answerValue: batch.id,
          answerLabel: batch.name,
        },
      });
    }
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).status).toBe('FULL');

    await expire(res.enrollmentId, { actor: 'cron' });

    const e = await db.enrollment.findUniqueOrThrow({ where: { id: res.enrollmentId } });
    expect(e).toMatchObject({ status: 'EXPIRED', zoomJoinUrl: null });
    expect((await db.lead.findUniqueOrThrow({ where: { id: trialLead.id } })).status).toBe(
      'EXPIRED',
    );
    expect(await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
      seatsTaken: 0,
      status: 'OPEN',
    });

    const sends = await db.job.findMany({ where: { type: 'sendMessage' }, orderBy: { id: 'asc' } });
    expect(sends.map((j) => j.payload)).toEqual([
      { leadId: trialLead.id, template: 'trial_ended', vars: { name: 'Test' } },
      {
        leadId: first.id,
        template: 'waitlist_seat_open',
        vars: { name: 'First', batch: batch.name },
      },
    ]);

    // Running it again is a no-op.
    await expire(res.enrollmentId, { actor: 'cron' });
    expect(await db.job.count({ where: { type: 'sendMessage' } })).toBe(2);
  });

  it('refuses while the lead has no edge to EXPIRED, changing nothing', async () => {
    const { batch } = await seedBasics();
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    await db.lead.update({ where: { id: lead.id }, data: { status: 'ENROLLED' } });

    await expect(expire(res.enrollmentId, { actor: 'cron' })).rejects.toThrow("Can't expire");

    expect(
      (await db.enrollment.findUniqueOrThrow({ where: { id: res.enrollmentId } })).status,
    ).toBe('TRIAL');
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).seatsTaken).toBe(1);
  });
});
