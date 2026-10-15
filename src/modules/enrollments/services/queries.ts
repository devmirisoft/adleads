import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { addDays, istDate } from '@/modules/core/utils';
import type { Paginated } from '@/modules/core/types';
import type { BatchOption, EnrollmentFilters } from '../types';

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

/** Batches with free seats (for assign / move dialogs). */
export async function listOpenBatches(): Promise<BatchOption[]> {
  const batches = await db.batch.findMany({
    where: { status: 'OPEN', endDate: { gte: istDate(await now()) } },
    include: { course: { select: { name: true } } },
    orderBy: [{ course: { sortOrder: 'asc' } }, { startTime: 'asc' }],
  });
  return batches.map((b) => ({
    id: b.id,
    name: b.name,
    courseId: b.courseId,
    courseName: b.course.name,
    seatsLeft: b.capacity - b.seatsTaken,
  }));
}

/** "Today" for days-left maths, honouring the dev clock (IST date as yyyy-MM-dd). */
export async function todayIst(): Promise<string> {
  return istDate(await now())
    .toISOString()
    .slice(0, 10);
}
