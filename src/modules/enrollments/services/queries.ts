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

/** Open and not over: bookable, since seats are unlimited. */
const bookable = async () =>
  ({ status: 'OPEN', endDate: { gte: istDate(await now()) } }) satisfies Prisma.BatchWhereInput;

/** Bookable batches (for assign / move / offer dialogs). */
export async function listOpenBatches(): Promise<BatchOption[]> {
  const batches = await db.batch.findMany({
    where: await bookable(),
    include: { course: { select: { name: true } } },
    orderBy: [{ course: { sortOrder: 'asc' } }, { startTime: 'asc' }],
  });
  return batches.map((b) => ({
    id: b.id,
    name: b.name,
    courseId: b.courseId,
    courseName: b.course.name,
    hasTrialLink: !!b.trialLink,
  }));
}

/** What the bot can book in this course now. */
export async function bookableBatches(courseId: string) {
  return db.batch.findMany({
    where: { courseId, ...(await bookable()) },
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    take: 10,
  });
}

/** Active courses the bot lists: those with a bookable batch. */
// ponytail: WhatsApp lists hold 10 rows; more than 10 such courses would need a second step.
export async function listableCourses() {
  return db.course.findMany({
    where: { isActive: true, batches: { some: await bookable() } },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });
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
