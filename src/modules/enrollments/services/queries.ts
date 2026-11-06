import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { addDays, istDate } from '@/modules/core/utils';
import type { Paginated } from '@/modules/core/types';
import type { BatchOption, EnrollmentFilters } from '../types';
import { outstandingOffer } from './assignSeat';

const listInclude = {
  lead: { select: { id: true, name: true, profileName: true, phoneE164: true, status: true } },
  batch: {
    select: {
      id: true,
      name: true,
      courseId: true,
      course: { select: { name: true, feePaise: true } },
    },
  },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentListItem = Prisma.EnrollmentGetPayload<{ include: typeof listInclude }>;

export async function listEnrollments(
  f: EnrollmentFilters,
): Promise<Paginated<EnrollmentListItem>> {
  const today = istDate(await now());
  const where: Prisma.EnrollmentWhereInput = {
    ...(f.q && {
      lead: {
        OR: [
          { name: { contains: f.q, mode: 'insensitive' } },
          { profileName: { contains: f.q, mode: 'insensitive' } },
          { phoneE164: { contains: f.q.replace(/[^\d+]/g, '') || f.q } },
        ],
      },
    }),
    ...(f.status && { status: f.status }),
    ...(f.batchId && { batchId: f.batchId }),
    ...(f.endingInDays !== undefined && {
      status: 'TRIAL',
      trialEnd: { gte: today, lte: addDays(today, f.endingInDays) },
    }),
  };
  const [items, total] = await Promise.all([
    db.enrollment.findMany({
      where,
      include: listInclude,
      orderBy: f.endingInDays !== undefined ? { trialEnd: 'asc' } : { createdAt: 'desc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    db.enrollment.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/** Seats on offer to waitlisted leads, as a `_count`. `exceptLeadId`'s own offer doesn't count. */
const heldCount = (at: Date, exceptLeadId?: string) => ({
  _count: {
    select: {
      waitlistOffers: {
        where: {
          ...outstandingOffer(at),
          ...(exceptLeadId && { leadId: { not: exceptLeadId } }),
        },
      },
    },
  },
});

const seatsLeft = (b: {
  capacity: number;
  seatsTaken: number;
  _count: { waitlistOffers: number };
}) => b.capacity - b.seatsTaken - b._count.waitlistOffers;

/** Batches with free seats (for assign / move / offer dialogs). `forLeadId` keeps their held seat. */
export async function listOpenBatches(forLeadId?: string): Promise<BatchOption[]> {
  const at = await now();
  const batches = await db.batch.findMany({
    where: { status: 'OPEN', endDate: { gte: istDate(at) } },
    include: { course: { select: { name: true } }, ...heldCount(at, forLeadId) },
    orderBy: [{ course: { sortOrder: 'asc' } }, { startTime: 'asc' }],
  });
  return batches
    .map((b) => ({
      id: b.id,
      name: b.name,
      courseId: b.courseId,
      courseName: b.course.name,
      seatsLeft: seatsLeft(b),
      hasTrialLink: !!b.trialLink,
    }))
    .filter((b) => b.seatsLeft > 0);
}

/** What the bot can book in this course now: open, not ended, with a seat no offer is holding. */
export async function bookableBatches(courseId: string) {
  const at = await now();
  const batches = await db.batch.findMany({
    where: { courseId, status: 'OPEN', endDate: { gte: istDate(at) } },
    include: heldCount(at),
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
  });
  return batches
    .map((b) => ({ ...b, seatsLeft: seatsLeft(b) }))
    .filter((b) => b.seatsLeft > 0)
    .slice(0, 10);
}

/**
 * Active courses the bot lists: those with a batch that isn't closed or over. With nothing to book
 * right now they stay listed as waitlist only, so the lead can still register interest.
 */
// ponytail: WhatsApp lists hold 10 rows; more than 10 such courses would need a second step.
export async function listableCourses() {
  const at = await now();
  const live = {
    status: { not: 'CLOSED' },
    endDate: { gte: istDate(at) },
  } satisfies Prisma.BatchWhereInput;
  const courses = await db.course.findMany({
    where: { isActive: true, batches: { some: live } },
    include: { batches: { where: live, include: heldCount(at) } },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });
  return courses.map(({ batches, ...course }) => ({
    ...course,
    waitlistOnly: !batches.some((b) => b.status === 'OPEN' && seatsLeft(b) > 0),
  }));
}

/** The seat offer this lead can book right now, if any. */
export async function currentOffer(leadId: string) {
  return db.waitlistOffer.findFirst({
    where: { leadId, ...outstandingOffer(await now()) },
    include: { batch: { select: { name: true } } },
  });
}

/** "Today" for days-left maths, honouring the dev clock (IST date as yyyy-MM-dd). */
export async function todayIst(): Promise<string> {
  return istDate(await now())
    .toISOString()
    .slice(0, 10);
}
