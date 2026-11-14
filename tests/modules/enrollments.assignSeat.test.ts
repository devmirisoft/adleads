import { beforeEach, describe, expect, it } from 'vitest';
import { assignSeat } from '@/modules/enrollments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

describe.skipIf(!hasTestDb)('assignSeat()', () => {
  beforeEach(resetDb);

  it('seats are unlimited: everyone racing in gets a trial and the count stays exact', async () => {
    const { batch, course } = await seedBasics();
    const leads = await Promise.all(Array.from({ length: 8 }, () => makeLead('QUALIFIED')));

    const results = await Promise.all(
      leads.map((l) => assignSeat(l.id, batch.id, { actor: 'test' })),
    );

    expect(results.every((r) => r.result === 'trial')).toBe(true);
    expect(await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
      seatsTaken: 8,
      status: 'OPEN',
    });
    expect(await db.lead.count({ where: { status: 'TRIAL_ACTIVE' } })).toBe(8);

    // Trial dates: 3-day course trial, inclusive end; trial link queued.
    const e = await db.enrollment.findFirstOrThrow();
    expect((e.trialEnd.getTime() - e.trialStart.getTime()) / 86_400_000).toBe(
      (course.trialDays ?? 3) - 1,
    );
    expect(await db.job.count({ where: { type: 'sendTrialLink' } })).toBe(8);
  });

  it('one free trial per phone number: a second booking changes nothing', async () => {
    const { batch } = await seedBasics();
    const lead = await makeLead('QUALIFIED');
    expect((await assignSeat(lead.id, batch.id, { actor: 'test' })).result).toBe('trial');

    // However they got back here (the status rules don't allow it today), no second trial.
    await db.lead.update({ where: { id: lead.id }, data: { status: 'QUALIFIED' } });
    expect(await assignSeat(lead.id, batch.id, { actor: 'test' })).toEqual({
      result: 'trialUsed',
    });
    expect(await db.enrollment.count()).toBe(1);
    expect(await db.job.count({ where: { type: 'sendTrialLink' } })).toBe(1);
    expect(await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).toMatchObject({
      seatsTaken: 1,
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
  });
});
