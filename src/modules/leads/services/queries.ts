import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { Paginated } from '@/modules/core/types';
import type { LeadFilters } from '../types';

/** IST calendar day "2026-10-14" → the UTC instant it starts. */
const istStart = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);

const listInclude = {
  course: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  enrollments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, status: true, batch: { select: { id: true, name: true } } },
  },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.LeadInclude;

export type LeadListItem = Prisma.LeadGetPayload<{ include: typeof listInclude }>;

export async function listLeads(f: LeadFilters): Promise<Paginated<LeadListItem>> {
  const where = leadWhere(f);
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    db.lead.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ponytail: export capped at 10k rows in memory; stream it if lists ever get bigger.
export async function exportLeadsCsv(f: LeadFilters): Promise<string> {
  const leads = await db.lead.findMany({
    where: leadWhere(f),
    include: listInclude,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
  });
  const header = [
    'Name',
    'Phone',
    'Status',
    'Course',
    'Batch',
    'Source',
    'Ad',
    'Needs human',
    'Assigned to',
    'Created (UTC)',
  ];
  const rows = leads.map((l) => [
    l.name ?? l.profileName,
    l.phoneE164,
    l.status,
    l.course?.name,
    l.enrollments[0]?.batch.name,
    l.source,
    l.adName,
    l.needsHuman ? 'yes' : 'no',
    l.assignedTo?.name,
    l.createdAt,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

function leadWhere(f: LeadFilters): Prisma.LeadWhereInput {
  return {
    ...(f.q && {
      OR: [
        { name: { contains: f.q, mode: 'insensitive' } },
        { profileName: { contains: f.q, mode: 'insensitive' } },
        { phoneE164: { contains: f.q.replace(/[^\d+]/g, '') || f.q } },
      ],
    }),
    ...(f.status && { status: f.status }),
    ...(f.courseId && { courseId: f.courseId }),
    ...(f.batchId && { enrollments: { some: { batchId: f.batchId } } }),
    ...(f.source && { source: f.source }),
    ...(f.needsHuman && { needsHuman: true }),
    ...((f.from || f.to) && {
      createdAt: {
        ...(f.from && { gte: istStart(f.from) }),
        ...(f.to && { lt: new Date(istStart(f.to).getTime() + 86_400_000) }),
      },
    }),
  };
}

export async function findLeadIdByPhone(phoneE164: string): Promise<string | null> {
  const lead = await db.lead.findUnique({ where: { phoneE164 }, select: { id: true } });
  return lead?.id ?? null;
}

export function getLeadDetail(id: string) {
  return db.lead.findUnique({
    where: { id },
    include: {
      course: true,
      assignedTo: { select: { id: true, name: true } },
      answers: { orderBy: { answeredAt: 'asc' } },
      enrollments: {
        orderBy: { createdAt: 'desc' },
        include: {
          batch: { include: { course: { select: { name: true, feePaise: true } } } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      },
      events: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}
export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;

// Inbox = needs a human, or the lead spoke last and nobody (bot or staff) has replied or
// resolved it yet. Resolving marks their inbound messages READ.
const inboxWhere = (assignedToId?: string) => Prisma.sql`
  FROM leads l
  LEFT JOIN LATERAL (
    SELECT m.direction, m.status, m.created_at FROM messages m
    WHERE m.lead_id = l.id ORDER BY m.created_at DESC LIMIT 1
  ) last ON true
  WHERE (l.needs_human OR (last.direction = 'IN' AND last.status <> 'READ'))
    AND l.status <> 'OPTED_OUT'
    ${assignedToId ? Prisma.sql`AND l.assigned_to_id = ${assignedToId}::uuid` : Prisma.empty}`;

export async function listInbox({
  assignedToId,
  page = 1,
  pageSize = 25,
}: {
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<LeadListItem>> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT l.id ${inboxWhere(assignedToId)}
    ORDER BY COALESCE(last.created_at, l.updated_at) DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const [leads, total] = await Promise.all([
    db.lead.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: listInclude }),
    countInbox(assignedToId),
  ]);
  const byId = new Map(leads.map((l) => [l.id, l]));
  return { items: rows.map((r) => byId.get(r.id)!), total, page, pageSize };
}

/** Nav badge count. */
export async function countInbox(assignedToId?: string): Promise<number> {
  const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count ${inboxWhere(assignedToId)}`;
  return Number(count);
}
