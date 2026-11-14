import { beforeEach, describe, expect, it } from 'vitest';
import { assignSeat, expire, sendTrialLink } from '@/modules/enrollments';
import { requestPayment } from '@/modules/payments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

describe.skipIf(!hasTestDb)('expire()', () => {
  beforeEach(resetDb);

  it('frees the seat and sends trial_ended, once', async () => {
    const { batch } = await seedBasics();
    const trialLead = await makeLead('QUALIFIED');
    const res = await assignSeat(trialLead.id, batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    await sendTrialLink(res.enrollmentId);
    await requestPayment(res.enrollmentId, { actor: 'test' }); // → PAYMENT_PENDING

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

    const sends = () =>
      db.job
        .findMany({ where: { type: 'sendMessage' }, orderBy: { id: 'asc' } })
        .then((jobs) => jobs.map((j) => j.payload));
    const trialEnded = { leadId: trialLead.id, template: 'trial_ended', vars: { name: 'Test' } };
    expect(await sends()).toEqual([trialEnded]);

    // Running it again is a no-op.
    await expire(res.enrollmentId, { actor: 'cron' });
    expect(await sends()).toEqual([trialEnded]);
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
