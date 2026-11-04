import { beforeEach, describe, expect, it } from 'vitest';
import { jobHandlers } from '@/app/_jobs/handlers';
import { updateBatch, type BatchInput } from '@/modules/batches';
import { assignSeat, moveBatch, queueNewLink, sendTrialLink } from '@/modules/enrollments';
import { runDue } from '@/modules/jobs';
import type { MessageBody } from '@/modules/messaging';
import { db, hasTestDb, makeLead, PAID_LINK, resetDb, seedBasics, TRIAL_LINK } from '../helpers/db';

const OLD_WINDOW = new Date(Date.now() - 25 * 3_600_000);

const enrollmentRow = (id: string) => db.enrollment.findUniqueOrThrow({ where: { id } });
const outgoing = (leadId: string) =>
  db.message.findMany({ where: { leadId, direction: 'OUT' }, orderBy: { createdAt: 'asc' } });
const textOf = (m: { body: unknown }) => (m.body as MessageBody).text;

/** Drop everything queued so far: tests here drive the job they care about directly. */
const clearJobs = () => db.job.deleteMany();

describe.skipIf(!hasTestDb)('class links', () => {
  let ids: Awaited<ReturnType<typeof seedBasics>>;
  beforeEach(async () => {
    await resetDb();
    ids = await seedBasics({ capacity: 10 });
  });

  async function trial() {
    const lead = await makeLead('QUALIFIED');
    const res = await assignSeat(lead.id, ids.batch.id, { actor: 'test' });
    if (res.result !== 'trial') throw new Error('expected a seat');
    return { lead, enrollmentId: res.enrollmentId };
  }

  /** A TRIAL, and a PAID enrollment holding `link` as if it had been sent. */
  async function trialAndPaid(link = PAID_LINK) {
    const onTrial = await trial();
    const paid = await trial();
    await db.lead.update({ where: { id: paid.lead.id }, data: { status: 'ENROLLED' } });
    await db.enrollment.update({
      where: { id: paid.enrollmentId },
      data: { status: 'PAID', zoomJoinUrl: link },
    });
    await clearJobs();
    return { onTrial, paid };
  }

  const setLinks = (data: { trialLink?: string | null; paidLink?: string | null }) =>
    db.batch.update({ where: { id: ids.batch.id }, data });

  describe('sendTrialLink', () => {
    it('sends the trial link as free text and stores it', async () => {
      const { lead, enrollmentId } = await trial();
      await sendTrialLink(enrollmentId);

      const [m] = await outgoing(lead.id);
      expect(m.type).toBe('TEXT');
      expect(textOf(m)).toContain(TRIAL_LINK);
      const e = await enrollmentRow(enrollmentId);
      expect(e.zoomJoinUrl).toBe(TRIAL_LINK);
      expect(e.linkSentAt).toBeTruthy();
    });

    it('outside the 24 h window it sends the class_reminder template instead', async () => {
      const { lead, enrollmentId } = await trial();
      await db.lead.update({ where: { id: lead.id }, data: { lastInboundAt: OLD_WINDOW } });
      await sendTrialLink(enrollmentId);

      const [m] = await outgoing(lead.id);
      expect(m).toMatchObject({ type: 'TEMPLATE', templateName: 'class_reminder' });
      expect(JSON.stringify(m.body)).toContain(TRIAL_LINK);
      expect((await enrollmentRow(enrollmentId)).zoomJoinUrl).toBe(TRIAL_LINK);
    });

    it('a re-run of the job does not resend; staff "Resend class link" does', async () => {
      const { lead, enrollmentId } = await trial();
      await sendTrialLink(enrollmentId, { once: true });
      await sendTrialLink(enrollmentId, { once: true });
      expect(await outgoing(lead.id)).toHaveLength(1);

      await sendTrialLink(enrollmentId);
      expect(await outgoing(lead.id)).toHaveLength(2);
    });

    it('no trial link: a plain error, nothing sent or stored', async () => {
      const { lead, enrollmentId } = await trial();
      await setLinks({ trialLink: null });

      await expect(sendTrialLink(enrollmentId)).rejects.toThrow(
        `${ids.batch.name} has no trial link yet`,
      );
      expect(await outgoing(lead.id)).toHaveLength(0);
      expect(await enrollmentRow(enrollmentId)).toMatchObject({
        zoomJoinUrl: null,
        linkSentAt: null,
      });
    });

    it('no trial link, as a job: retries, then flags the lead', async () => {
      const { lead } = await trial();
      await setLinks({ trialLink: null });

      const first = await runDue(jobHandlers);
      expect(first.failed).toHaveLength(1);
      expect(first.failed[0].error).toContain('has no trial link yet');
      expect((await db.job.findFirstOrThrow()).status).toBe('PENDING'); // will retry
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(false);

      await db.job.updateMany({ data: { attempts: 4, runAt: new Date(0) } }); // last attempt next
      await runDue(jobHandlers);
      expect((await db.job.findFirstOrThrow()).status).toBe('FAILED');
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsHuman).toBe(true);
    });

    it('an opted-out lead gets nothing, so nothing is stored as sent', async () => {
      const { lead, enrollmentId } = await trial();
      await db.lead.update({ where: { id: lead.id }, data: { optedOutAt: new Date() } });
      await sendTrialLink(enrollmentId);

      expect(await outgoing(lead.id)).toHaveLength(0);
      expect((await enrollmentRow(enrollmentId)).zoomJoinUrl).toBeNull();
    });
  });

  describe('moveBatch', () => {
    const otherBatch = (data: { trialLink?: string; paidLink?: string }) =>
      db.batch.create({
        data: {
          courseId: ids.course.id,
          name: 'Morning',
          daysOfWeek: ids.batch.daysOfWeek,
          startTime: '07:00',
          endTime: '08:00',
          startDate: ids.batch.startDate,
          endDate: ids.batch.endDate,
          capacity: 5,
          ...data,
        },
      });

    it('a TRIAL gets the new batch trial link', async () => {
      const { lead, enrollmentId } = await trial();
      await runDue(jobHandlers);
      const other = await otherBatch({ trialLink: 'https://zoom.example/j/new-trial' });

      await moveBatch(enrollmentId, other.id);
      expect((await enrollmentRow(enrollmentId)).zoomJoinUrl).toBeNull();
      await runDue(jobHandlers);

      expect((await enrollmentRow(enrollmentId)).zoomJoinUrl).toBe(
        'https://zoom.example/j/new-trial',
      );
      expect(textOf((await outgoing(lead.id)).at(-1)!)).toContain(
        'https://zoom.example/j/new-trial',
      );
    });

    it('a PAID enrollment gets the new batch paid link, never its trial link', async () => {
      const { paid } = await trialAndPaid();
      const other = await otherBatch({
        trialLink: 'https://zoom.example/j/new-trial',
        paidLink: 'https://zoom.example/j/new-paid',
      });

      await moveBatch(paid.enrollmentId, other.id);
      await runDue(jobHandlers);

      expect((await enrollmentRow(paid.enrollmentId)).zoomJoinUrl).toBe(
        'https://zoom.example/j/new-paid',
      );
      const sent = textOf((await outgoing(paid.lead.id)).at(-1)!);
      expect(sent).toContain('https://zoom.example/j/new-paid');
      expect(sent).not.toContain('new-trial');
    });

    it('a PAID enrollment outside the window gets the enrollment_confirmed template', async () => {
      const { paid } = await trialAndPaid();
      await db.lead.update({ where: { id: paid.lead.id }, data: { lastInboundAt: OLD_WINDOW } });
      const other = await otherBatch({ paidLink: 'https://zoom.example/j/new-paid' });

      await moveBatch(paid.enrollmentId, other.id);
      await runDue(jobHandlers);

      expect((await outgoing(paid.lead.id)).at(-1)).toMatchObject({
        type: 'TEMPLATE',
        templateName: 'enrollment_confirmed',
      });
    });
  });

  describe('"send the new link to N people"', () => {
    const NEW_TRIAL = 'https://zoom.example/j/rotated-trial';
    const NEW_PAID = 'https://zoom.example/j/rotated-paid';

    it('the trial link goes to TRIAL enrollments only', async () => {
      const { onTrial, paid } = await trialAndPaid();
      await setLinks({ trialLink: NEW_TRIAL });

      expect(await queueNewLink(ids.batch.id, 'trial')).toBe(1);
      expect(await runDue(jobHandlers)).toEqual({ done: 1, failed: [] });

      expect((await enrollmentRow(onTrial.enrollmentId)).zoomJoinUrl).toBe(NEW_TRIAL);
      expect(textOf((await outgoing(onTrial.lead.id)).at(-1)!)).toContain(NEW_TRIAL);
      expect((await enrollmentRow(paid.enrollmentId)).zoomJoinUrl).toBe(PAID_LINK);
      expect(await outgoing(paid.lead.id)).toHaveLength(0);
    });

    it('the paid link goes to PAID enrollments only', async () => {
      const { onTrial, paid } = await trialAndPaid();
      await setLinks({ paidLink: NEW_PAID });

      expect(await queueNewLink(ids.batch.id, 'paid')).toBe(1);
      await runDue(jobHandlers);

      expect((await enrollmentRow(paid.enrollmentId)).zoomJoinUrl).toBe(NEW_PAID);
      expect(textOf((await outgoing(paid.lead.id)).at(-1)!)).toContain(NEW_PAID);
      expect(await outgoing(onTrial.lead.id)).toHaveLength(0);
    });

    it('free text inside the window, otherwise the stage template', async () => {
      const { onTrial, paid } = await trialAndPaid();
      const late = await trial();
      await clearJobs();
      await db.lead.updateMany({
        where: { id: { in: [late.lead.id, paid.lead.id] } },
        data: { lastInboundAt: OLD_WINDOW },
      });
      await setLinks({ trialLink: NEW_TRIAL, paidLink: NEW_PAID });

      await queueNewLink(ids.batch.id, 'trial');
      await queueNewLink(ids.batch.id, 'paid');
      await runDue(jobHandlers);

      expect((await outgoing(onTrial.lead.id)).at(-1)).toMatchObject({ type: 'TEXT' });
      expect((await outgoing(late.lead.id)).at(-1)).toMatchObject({
        type: 'TEMPLATE',
        templateName: 'class_reminder',
      });
      expect((await outgoing(paid.lead.id)).at(-1)).toMatchObject({
        type: 'TEMPLATE',
        templateName: 'enrollment_confirmed',
      });
      expect((await enrollmentRow(late.enrollmentId)).zoomJoinUrl).toBe(NEW_TRIAL);
      expect((await enrollmentRow(paid.enrollmentId)).zoomJoinUrl).toBe(NEW_PAID);
    });

    it('opted-out leads are left out of the count and the sends', async () => {
      const { onTrial } = await trialAndPaid();
      const gone = await trial();
      await clearJobs();
      await db.lead.update({ where: { id: gone.lead.id }, data: { optedOutAt: new Date() } });
      await setLinks({ trialLink: NEW_TRIAL });

      expect(await queueNewLink(ids.batch.id, 'trial')).toBe(1);
      await runDue(jobHandlers);

      expect((await enrollmentRow(onTrial.enrollmentId)).zoomJoinUrl).toBe(NEW_TRIAL);
      expect(await outgoing(gone.lead.id)).toHaveLength(0);
    });

    it('confirming twice, or a job re-run, does not message twice', async () => {
      const { onTrial } = await trialAndPaid();
      await setLinks({ trialLink: NEW_TRIAL });

      await queueNewLink(ids.batch.id, 'trial');
      await queueNewLink(ids.batch.id, 'trial');
      expect(await runDue(jobHandlers)).toEqual({ done: 2, failed: [] });

      expect(await outgoing(onTrial.lead.id)).toHaveLength(1);
    });

    it('someone who paid while the send was queued does not get the trial link', async () => {
      const { onTrial } = await trialAndPaid();
      await setLinks({ trialLink: NEW_TRIAL });
      await queueNewLink(ids.batch.id, 'trial');

      await db.enrollment.update({
        where: { id: onTrial.enrollmentId },
        data: { status: 'PAID', zoomJoinUrl: PAID_LINK },
      });
      await runDue(jobHandlers);

      expect(await outgoing(onTrial.lead.id)).toHaveLength(0);
      expect((await enrollmentRow(onTrial.enrollmentId)).zoomJoinUrl).toBe(PAID_LINK);
    });

    it('someone who never got a link is reached once one is added', async () => {
      await setLinks({ trialLink: null });
      const { lead, enrollmentId } = await trial();
      await clearJobs();
      await setLinks({ trialLink: NEW_TRIAL });

      expect(await queueNewLink(ids.batch.id, 'trial')).toBe(1);
      await runDue(jobHandlers);

      expect((await enrollmentRow(enrollmentId)).zoomJoinUrl).toBe(NEW_TRIAL);
      expect(textOf((await outgoing(lead.id))[0])).toContain(NEW_TRIAL);
    });
  });

  describe('updateBatch reports what to offer', () => {
    const input = (links: { trialLink?: string; paidLink?: string }): BatchInput => ({
      courseId: ids.course.id,
      name: ids.batch.name,
      daysOfWeek: ids.batch.daysOfWeek,
      startTime: ids.batch.startTime,
      endTime: ids.batch.endTime,
      startDate: '2026-01-01',
      endDate: '2099-12-31',
      capacity: ids.batch.capacity,
      zoomHostUser: 'host@zoom.example',
      trialLink: TRIAL_LINK,
      paidLink: PAID_LINK,
      ...links,
    });

    it('unchanged links offer nothing', async () => {
      await trialAndPaid();
      expect((await updateBatch(ids.batch.id, input({}))).linkChanges).toEqual([]);
    });

    it('a changed link offers its own audience, and the count matches what gets queued', async () => {
      await trialAndPaid();
      await trial();
      await clearJobs();

      const { linkChanges } = await updateBatch(
        ids.batch.id,
        input({ trialLink: 'https://zoom.example/j/a', paidLink: 'https://zoom.example/j/b' }),
      );

      expect(linkChanges).toEqual([
        { kind: 'trial', recipients: 2 },
        { kind: 'paid', recipients: 1 },
      ]);
      expect(await queueNewLink(ids.batch.id, 'trial')).toBe(2);
      expect(await queueNewLink(ids.batch.id, 'paid')).toBe(1);
    });

    it('an old host overlap blocks a schedule change, but never a new link', async () => {
      await db.batch.create({
        data: {
          courseId: ids.course.id,
          name: 'Overlapping',
          daysOfWeek: ids.batch.daysOfWeek,
          startTime: ids.batch.startTime,
          endTime: ids.batch.endTime,
          startDate: ids.batch.startDate,
          endDate: ids.batch.endDate,
          capacity: 5,
          zoomHostUser: 'host@zoom.example',
        },
      });
      const { batch } = await updateBatch(
        ids.batch.id,
        input({ trialLink: 'https://zoom.example/j/a' }),
      );
      expect(batch.trialLink).toBe('https://zoom.example/j/a');

      await expect(updateBatch(ids.batch.id, { ...input({}), endTime: '20:30' })).rejects.toThrow(
        'already hosts',
      );
    });

    it('nobody to tell, or a link removed: nothing to offer', async () => {
      expect(
        (await updateBatch(ids.batch.id, input({ trialLink: 'https://zoom.example/j/a' })))
          .linkChanges,
      ).toEqual([]);

      await trial();
      const { batch, linkChanges } = await updateBatch(ids.batch.id, input({ trialLink: '' }));
      expect(linkChanges).toEqual([]);
      expect(batch.trialLink).toBeNull();
    });
  });
});
