import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { addDays, istDate } from '@/modules/core/utils';

const DAY = 86_400_000;
/** IST calendar day "yyyy-MM-dd" → the UTC instant it starts. */
const istStart = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

export type Range = { from: string; to: string };

/** The dashboard's date range: from the URL, else the last 30 days (IST). */
export async function resolveRange(from?: string, to?: string): Promise<Range> {
  const today = istDate(await now());
  return { from: from ?? ymdOf(addDays(today, -29)), to: to ?? ymdOf(today) };
}

const createdIn = (r: Range) => ({
  gte: istStart(r.from),
  lt: new Date(istStart(r.to).getTime() + DAY),
});

export async function getStats() {
  const today = ymdOf(istDate(await now()));
  const todayStart = istStart(today);
  const monthStart = istStart(`${today.slice(0, 8)}01`);
  const thirtyAgo = addDays(new Date(today), -30);

  const [leadsToday, leads7d, activeTrials, paid30, expired30, revenue] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: todayStart } } }),
    db.lead.count({ where: { createdAt: { gte: new Date(todayStart.getTime() - 6 * DAY) } } }),
    db.enrollment.count({ where: { status: 'TRIAL' } }),
    db.enrollment.count({ where: { trialStart: { gte: thirtyAgo }, paidAt: { not: null } } }),
    db.enrollment.count({ where: { trialStart: { gte: thirtyAgo }, status: 'EXPIRED' } }),
    db.payment.aggregate({
      _sum: { amountPaise: true },
      where: { status: 'PAID', paidAt: { gte: monthStart } },
    }),
  ]);
  const finished = paid30 + expired30;
  return {
    leadsToday,
    leads7d,
    activeTrials,
    /** Of trials started in the last 30 days that have ended, the share that paid. null = none ended yet. */
    trialToPaidPct: finished ? Math.round((paid30 / finished) * 100) : null,
    revenueThisMonthPaise: revenue._sum.amountPaise ?? 0,
  };
}

/** Leads created in the range, counted by their current status. */
export async function getFunnel(range: Range) {
  const rows = await db.lead.groupBy({
    by: ['status'],
    where: { createdAt: createdIn(range) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}

/** Ad performance for leads created in the range. */
export async function getLeadsByAd(range: Range) {
  const rows = await db.lead.groupBy({
    by: ['adId', 'adName'],
    where: { source: 'CTWA_AD', createdAt: createdIn(range) },
    _count: { _all: true },
  });
  const enrolled = await db.lead.groupBy({
    by: ['adId'],
    where: { source: 'CTWA_AD', createdAt: createdIn(range), status: 'ENROLLED' },
    _count: { _all: true },
  });
  const enrolledBy = new Map(enrolled.map((e) => [e.adId, e._count._all]));
  return rows
    .map((r) => {
      const won = enrolledBy.get(r.adId) ?? 0;
      return {
        adId: r.adId ?? 'unknown',
        adName: r.adName ?? r.adId ?? 'Unknown ad',
        leads: r._count._all,
        enrolled: won,
        conversionPct: Math.round((won / r._count._all) * 100),
      };
    })
    .sort((a, b) => b.leads - a.leads);
}
export type AdRow = Awaited<ReturnType<typeof getLeadsByAd>>[number];

/** Which batches new leads join: enrollments (not cancelled) of leads created in the range, per batch. */
export async function getBatchPreference(range: Range) {
  const rows = await db.enrollment.groupBy({
    by: ['batchId'],
    where: { status: { not: 'CANCELLED' }, lead: { createdAt: createdIn(range) } },
    _count: { _all: true },
  });
  const batches = await db.batch.findMany({
    where: { id: { in: rows.map((r) => r.batchId) } },
    select: { id: true, name: true, course: { select: { name: true } } },
  });
  const labelOf = new Map(batches.map((b) => [b.id, `${b.course.name} – ${b.name}`]));
  return rows.map((r) => ({
    label: labelOf.get(r.batchId) ?? 'Unknown batch',
    value: r._count._all,
  }));
}

const NO_COURSE = 'none';

/**
 * Per course: leads created in the range by their current status (the course they chose), and
 * payments received in the range. Most-chosen course first.
 */
// ponytail: sums payments in JS; move to a GROUP BY query if a range ever holds tens of thousands.
export async function getCourseBreakdown(range: Range) {
  const [leads, payments] = await Promise.all([
    db.lead.groupBy({
      by: ['courseId', 'status'],
      where: { createdAt: createdIn(range) },
      _count: { _all: true },
    }),
    db.payment.findMany({
      where: { status: 'PAID', paidAt: createdIn(range) },
      select: {
        amountPaise: true,
        enrollment: { select: { batch: { select: { courseId: true } } } },
      },
    }),
  ]);

  type Row = {
    courseId: string;
    course: string;
    leads: number;
    byStatus: Record<string, number>;
    revenuePaise: number;
  };
  const rows = new Map<string, Row>();
  const rowOf = (courseId: string) => {
    let row = rows.get(courseId);
    if (!row) {
      row = { courseId, course: '', leads: 0, byStatus: {}, revenuePaise: 0 };
      rows.set(courseId, row);
    }
    return row;
  };
  for (const l of leads) {
    const row = rowOf(l.courseId ?? NO_COURSE);
    row.leads += l._count._all;
    row.byStatus[l.status] = (row.byStatus[l.status] ?? 0) + l._count._all;
  }
  for (const p of payments) rowOf(p.enrollment.batch.courseId).revenuePaise += p.amountPaise;

  const courses = await db.course.findMany({
    where: { id: { in: [...rows.keys()].filter((id) => id !== NO_COURSE) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(courses.map((c) => [c.id, c.name]));
  return [...rows.values()]
    .map((r) => ({
      ...r,
      course: r.courseId === NO_COURSE ? 'No course chosen yet' : (nameOf.get(r.courseId) ?? '—'),
    }))
    .sort((a, b) => b.leads - a.leads || b.revenuePaise - a.revenuePaise);
}
export type CourseRow = Awaited<ReturnType<typeof getCourseBreakdown>>[number];
