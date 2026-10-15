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
