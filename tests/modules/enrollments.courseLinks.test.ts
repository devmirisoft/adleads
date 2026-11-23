import { beforeEach, describe, expect, it } from 'vitest';
import { jobHandlers } from '@/app/_jobs/handlers';
import { setDevNowOffsetDays } from '@/lib/clock';
import { addDays, istDate } from '@/modules/core/utils';
import { linkIndexForDay } from '@/modules/enrollments';
import { inviteLink } from '@/modules/enrollments/services/sendTrialLink';
import { runDue } from '@/modules/jobs';
import { runCourseLinks } from '@/modules/payments';
import { db, hasTestDb, makeLead, resetDb, seedBasics } from '../helpers/db';

const DAY = 86_400_000;

describe('linkIndexForDay', () => {
  it('daily: link k on day k + 1, nothing after the last', () => {
    expect([1, 2, 3, 4].map((d) => linkIndexForDay(d, 3, 1))).toEqual([0, 1, 2, null]);
  });
  it('every 2 days: days 1, 3, 5', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => linkIndexForDay(d, 3, 2))).toEqual([
      0,
      null,
      1,
      null,
      2,
      null,
      null,
    ]);
  });
  it('nothing before day 1 or without links', () => {
    expect(linkIndexForDay(0, 3, 1)).toBeNull();
    expect(linkIndexForDay(1, 0, 1)).toBeNull();
  });
});

describe('inviteLink', () => {
  it('shares a ready message whose link opens a chat with us naming the inviter', () => {
    const url = new URL(inviteLink('919812345678', 'Rahul'));
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    const shared = url.searchParams.get('text')!;
    expect(shared).toContain('Rahul invited you');
    const join = new URL(shared.slice(shared.indexOf('https://')));
    expect(join.pathname).toBe('/919812345678');
    expect(join.searchParams.get('text')).toBe(
      "Hi, Rahul invited me. I'd like to join a free trial",
    );
  });
});

describe.skipIf(!hasTestDb)('runCourseLinks', () => {
  const LINKS = [
    'https://v.example/1',
    'https://v.example/2',
    'https://v.example/3',
    'https://v.example/4',
  ];
  let ids: Awaited<ReturnType<typeof seedBasics>>;

  /** Move the dev clock so "now" is `hh`:00 IST on the real today. */
  async function setIstHour(hh: number) {
    const today = istDate(new Date()); // UTC midnight of today's IST date
    const target = today.getTime() + hh * 3_600_000 - 5.5 * 3_600_000; // hh:00 IST
    await setDevNowOffsetDays((target - Date.now()) / DAY);
  }

  /** A lead on trial (or paid) whose trial started `daysAgo` IST days ago. */
  async function enrolled(daysAgo: number, status: 'TRIAL' | 'PAID' = 'TRIAL') {
    const lead = await makeLead(status === 'TRIAL' ? 'TRIAL_ACTIVE' : 'ENROLLED');
    const today = istDate(new Date());
    const e = await db.enrollment.create({
      data: {
        leadId: lead.id,
        batchId: ids.batch.id,
        status,
        trialStart: addDays(today, -daysAgo),
        trialEnd: addDays(today, 30),
      },
    });
    return { lead, e };
  }

  const queuedLinks = async () =>
    (await db.job.findMany({ where: { type: 'sendMessage' }, orderBy: { id: 'asc' } }))
      .map((j) => j.payload as { leadId: string; template: string; vars: Record<string, string> })
      .filter((p) => p.template === 'course_link');

  beforeEach(async () => {
    await resetDb();
    ids = await seedBasics();
    await db.course.update({ where: { id: ids.course.id }, data: { links: LINKS } });
    await setIstHour(10);
  });

  it('each lead gets the link for their own day, once', async () => {
    const a = await enrolled(3); // day 4
    const b = await enrolled(0); // day 1
    const paid = await enrolled(1, 'PAID'); // day 2: links carry on after payment

    expect((await runCourseLinks()).courseLinks).toBe(3);
    const sent = await queuedLinks();
    const linkFor = (leadId: string) => sent.find((p) => p.leadId === leadId)?.vars;
    expect(linkFor(a.lead.id)).toMatchObject({ number: '4', link: LINKS[3] });
    expect(linkFor(b.lead.id)).toMatchObject({ number: '1', link: LINKS[0] });
    expect(linkFor(paid.lead.id)).toMatchObject({ number: '2', link: LINKS[1] });

    // A second run the same day queues nothing.
    expect((await runCourseLinks()).courseLinks).toBe(0);
    expect(await queuedLinks()).toHaveLength(3);

    // The job sends the course_link template.
    await runDue(jobHandlers);
    const m = await db.message.findFirst({
      where: { leadId: b.lead.id, templateName: 'course_link' },
    });
    expect(JSON.stringify(m?.body)).toContain(LINKS[0]);
  });

  it('after the last link, an unpaid trial gets its payment link; a paid one does not', async () => {
    const trial = await enrolled(3); // day 4 = last link
    const paid = await enrolled(3, 'PAID');

    const res = await runCourseLinks();
    expect(res.courseLinks).toBe(2);
    expect(res.paymentReminders).toEqual({ done: 1, failed: [] });

    expect((await db.lead.findUniqueOrThrow({ where: { id: trial.lead.id } })).status).toBe(
      'PAYMENT_PENDING',
    );
    const reminders = await db.message.findMany({
      where: { templateName: 'trial_payment_reminder' },
    });
    expect(reminders.map((r) => r.leadId)).toEqual([trial.lead.id]);
    expect(await db.payment.count({ where: { enrollmentId: paid.e.id } })).toBe(0);
  });

  it('skips days between links, leads past the last link, and anything before 08:00 IST', async () => {
    await db.course.update({ where: { id: ids.course.id }, data: { linkIntervalDays: 2 } });
    await enrolled(1); // day 2: between link 1 (day 1) and link 2 (day 3)
    await enrolled(10); // day 11: past link 4 (day 7)
    expect((await runCourseLinks()).courseLinks).toBe(0);

    await db.course.update({ where: { id: ids.course.id }, data: { linkIntervalDays: 1 } });
    await setIstHour(7);
    await enrolled(0);
    expect((await runCourseLinks()).courseLinks).toBe(0);
    await setIstHour(8);
    expect((await runCourseLinks()).courseLinks).toBe(2); // day 1 and day 2 leads
  });
});
