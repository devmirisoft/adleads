import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobHandlers } from '@/app/_jobs/handlers';
import { zoom } from '@/lib/zoom/client';
import { assignSeat, moveBatch, sendTrialLink } from '@/modules/enrollments';
import { JOB_TYPES, runDue, type JobHandlers, type JobType } from '@/modules/jobs';
import { markPaid, refundPayment, requestPayment } from '@/modules/payments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

const allTypes = (run: JobHandlers[JobType]) =>
  Object.fromEntries(JOB_TYPES.map((t) => [t, run])) as JobHandlers;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** A job some process claimed `age` minutes ago. */
const running = (age: number, attempts: number, payload = {}) =>
  db.job.create({
    data: { type: 'sendMessage', payload, status: 'RUNNING', attempts, updatedAt: minutesAgo(age) },
  });

const queued = () => db.job.create({ data: { type: 'sendMessage', payload: {} } });

describe.skipIf(!hasTestDb)('runDue()', () => {
  beforeEach(resetDb);

  it('re-runs a job stuck RUNNING for over 5 minutes, leaves a recent one alone', async () => {
    const stuck = await running(6, 1);
    const recent = await running(4, 1);
    const handler = vi.fn(async () => {});

    expect(await runDue(allTypes(handler))).toEqual({ done: 1, failed: [] });

    expect(handler).toHaveBeenCalledOnce();
    const after = await db.job.findUniqueOrThrow({ where: { id: stuck.id } });
    expect([after.status, after.attempts]).toEqual(['DONE', 2]);
    const untouched = await db.job.findUniqueOrThrow({ where: { id: recent.id } });
    expect([untouched.status, untouched.attempts]).toEqual(['RUNNING', 1]);
  });

  it('a stuck job with no attempts left is FAILED and flags its lead, without running', async () => {
    const lead = await makeLead();
    const stuck = await running(6, 5, { leadId: lead.id });
    const handler = vi.fn(async () => {});

    await runDue(allTypes(handler));

    expect(handler).not.toHaveBeenCalled();
    const after = await db.job.findUniqueOrThrow({ where: { id: stuck.id } });
    expect(after.status).toBe('FAILED');
    expect(after.lastError).toMatch(/mid-job/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(true);
  });

  it('claims one job at a time, up to the limit', async () => {
    await Promise.all([queued(), queued(), queued()]);
    const runningNow: number[] = [];
    const handler = async () => {
      runningNow.push(await db.job.count({ where: { status: 'RUNNING' } }));
    };

    expect((await runDue(allTypes(handler), 2)).done).toBe(2);

    expect(runningNow).toEqual([1, 1]); // a kill here would strand only the job in flight
    expect(await db.job.count({ where: { status: 'PENDING' } })).toBe(1);
  });
});

describe.skipIf(!hasTestDb)('jobs are safe to run twice', () => {
  beforeEach(resetDb);

  const trial = async () => {
    const { batch, course } = await seedBasics();
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    return { batch, course, lead, enrollmentId: res.enrollmentId };
  };

  it('zoomRegister: a re-run sends nothing; a batch move and staff resend still do', async () => {
    const { batch, course, lead, enrollmentId } = await trial();
    const links = () => db.message.count({ where: { leadId: lead.id, direction: 'OUT' } });
    const enrollment = () => db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });

    await jobHandlers.zoomRegister({ enrollmentId });
    const registered = await enrollment();
    await jobHandlers.zoomRegister({ enrollmentId });
    expect(await links()).toBe(1);
    expect((await enrollment()).zoomRegistrantId).toBe(registered.zoomRegistrantId);

    await sendTrialLink(enrollmentId); // "Resend class link"
    expect(await links()).toBe(2);

    // A key on the lead (trial:<leadId>) would wrongly swallow this one.
    const other = await db.batch.create({
      data: {
        courseId: course.id,
        name: 'Morning',
        daysOfWeek: batch.daysOfWeek,
        startTime: batch.startTime,
        endTime: batch.endTime,
        startDate: batch.startDate,
        endDate: batch.endDate,
        capacity: batch.capacity,
        zoomMeetingId: BigInt(81000000003),
        zoomHostUser: batch.zoomHostUser,
      },
    });
    await moveBatch(enrollmentId, other.id);
    await jobHandlers.zoomRegister({ enrollmentId });
    expect(await links()).toBe(3);
    expect((await enrollment()).zoomRegistrantId).not.toBe(registered.zoomRegistrantId);
  });

  it('refund: a retry after Zoom fails finishes the cancel, and a third run changes nothing', async () => {
    const { batch, enrollmentId } = await trial();
    await sendTrialLink(enrollmentId);
    const payment = await requestPayment(enrollmentId, { actor: 'test' });
    await markPaid({
      paymentId: payment.id,
      method: 'RAZORPAY',
      amountPaise: payment.amountPaise,
      razorpayPaymentId: 'pay_refund_test',
      actor: 'test',
    });
    const refund = () => refundPayment(payment.id, 'Test', { actor: 'test' });

    const spy = vi.spyOn(zoom, 'cancelRegistrant').mockRejectedValueOnce(new Error('Zoom down'));
    await expect(refund()).rejects.toThrow('Zoom down');
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID');

    await refund();
    await refund();
    spy.mockRestore();

    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'REFUNDED',
    );
    const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    expect(e.status).toBe('CANCELLED');
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).seatsTaken).toBe(0);
  });
});
