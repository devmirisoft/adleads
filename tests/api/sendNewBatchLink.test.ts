import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendNewBatchLink } from '@/app/_jobs/actions';
import { assignSeat } from '@/modules/enrollments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

// `after` and `connection` need a live Next request: capture the kick so a test can see it was asked for.
const afterTasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => afterTasks.push(task),
  connection: async () => {},
}));

const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth')>()),
  auth: async () => ({ user: { id: session.userId } }),
}));

async function signIn(role: 'ADMIN' | 'SALES' | 'VIEWER') {
  const user = await db.user.create({
    data: { name: 'Staff', email: `${role}@x.test`, passwordHash: 'x', role },
  });
  session.userId = user.id;
}

describe.skipIf(!hasTestDb)('sendNewBatchLink', () => {
  let batchId: string;
  beforeEach(async () => {
    await resetDb();
    afterTasks.length = 0;
    batchId = (await seedBasics()).batch.id;
    await assignSeat((await makeLead('QUALIFIED')).id, batchId, { actor: 'test' });
    await db.job.deleteMany();
  });

  it('an admin queues the sends and kicks the runner', async () => {
    await signIn('ADMIN');
    expect(await sendNewBatchLink(batchId, 'trial')).toEqual({ ok: true, data: 1 });
    expect(await db.job.count({ where: { type: 'sendMessage' } })).toBe(1);
    expect(afterTasks).toHaveLength(1);
  });

  it.each(['SALES', 'VIEWER'] as const)('%s is kept out: nothing queued', async (role) => {
    await signIn(role);
    await expect(sendNewBatchLink(batchId, 'trial')).rejects.toThrow('NEXT_REDIRECT');
    expect(await db.job.count()).toBe(0);
    expect(afterTasks).toHaveLength(0);
  });

  it('refuses a made-up link kind', async () => {
    await signIn('ADMIN');
    expect((await sendNewBatchLink(batchId, 'other' as 'trial')).ok).toBe(false);
    expect(await db.job.count()).toBe(0);
  });
});
