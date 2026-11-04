import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordManualPaymentAndRunJobs } from '@/app/_jobs/actions';
import { assignSeat } from '@/modules/enrollments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

// `after` and `guarded` both need a live Next request. Capture one, stand in for the other.
const afterTasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
const staff = vi.hoisted(() => ({ id: '' }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => afterTasks.push(task),
}));
vi.mock('@/modules/auth', async (original) => ({
  ...(await original<typeof import('@/modules/auth')>()),
  guarded: async (_roles: unknown, run: (user: { id: string }) => Promise<unknown>) => {
    try {
      return { ok: true, data: await run(staff) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
}));

describe.skipIf(!hasTestDb)('recordManualPaymentAndRunJobs()', () => {
  beforeEach(async () => {
    afterTasks.length = 0;
    await resetDb();
    const user = await db.user.create({
      data: { name: 'Staff', email: 'staff@example.com', passwordHash: 'x', role: 'ADMIN' },
    });
    staff.id = user.id;
  });

  const trial = async () => {
    const { batch } = await seedBasics();
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    return { leadId: lead.id, enrollmentId: res.enrollmentId };
  };

  it('sends nothing directly, then one confirmation straight after the response', async () => {
    const { leadId, enrollmentId } = await trial();
    const confirmations = () =>
      db.message.count({ where: { leadId, templateName: 'enrollment_confirmed' } });

    const res = await recordManualPaymentAndRunJobs({ enrollmentId, method: 'CASH', rupees: 2999 });

    expect(res.ok).toBe(true);
    expect(await confirmations()).toBe(0);
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]();
    expect(await confirmations()).toBe(1);
  });

  it('a rejected payment runs nothing', async () => {
    const { enrollmentId } = await trial();

    const res = await recordManualPaymentAndRunJobs({ enrollmentId, method: 'CASH', rupees: 1 });

    expect(res.ok).toBe(false);
    expect(afterTasks).toHaveLength(0);
  });
});
