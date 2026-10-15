import { beforeEach, describe, expect, it } from 'vitest';
import { assignSeat } from '@/modules/enrollments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

describe.skipIf(!hasTestDb)('assignSeat()', () => {
  beforeEach(resetDb);

  it('two leads racing for the last seat → exactly one TRIAL, one WAITLISTED', async () => {
    const { batch, course } = await seedBasics({ capacity: 1 });
    const [a, b] = await Promise.all([makeLead('QUALIFIED'), makeLead('QUALIFIED')]);

    const results = await Promise.all([
      assignSeat(a.id, batch.id, { actor: 'test' }),
      assignSeat(b.id, batch.id, { actor: 'test' }),
    ]);

    expect(results.map((r) => r.result).sort()).toEqual(['trial', 'waitlisted']);
    const statuses = await db.lead.findMany({
      where: { id: { in: [a.id, b.id] } },
      select: { status: true },
    });
    expect(statuses.map((s) => s.status).sort()).toEqual(['TRIAL_ACTIVE', 'WAITLISTED']);
    const after = await db.batch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(after).toMatchObject({ seatsTaken: 1, status: 'FULL' });
    expect(await db.enrollment.count()).toBe(1);

    // Trial dates: 3-day course trial, inclusive end; Zoom registration queued.
    const e = await db.enrollment.findFirstOrThrow();
    expect((e.trialEnd.getTime() - e.trialStart.getTime()) / 86_400_000).toBe(
      (course.trialDays ?? 3) - 1,
    );
    expect(await db.job.count({ where: { type: 'zoomRegister' } })).toBe(1);
  });

  it('never oversells under heavier contention', async () => {
    const { batch } = await seedBasics({ capacity: 3 });
    const leads = await Promise.all(Array.from({ length: 8 }, () => makeLead('QUALIFIED')));
    const results = await Promise.all(
      leads.map((l) => assignSeat(l.id, batch.id, { actor: 'test' })),
    );
    expect(results.filter((r) => r.result === 'trial')).toHaveLength(3);
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).seatsTaken).toBe(3);
  });
});
