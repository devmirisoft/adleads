import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { Paginated } from '@/modules/core/types';
import type { BatchFilters } from '../types';

const listInclude = { course: { select: { id: true, name: true } } } satisfies Prisma.BatchInclude;
export type BatchListItem = Prisma.BatchGetPayload<{ include: typeof listInclude }>;

export async function listBatches(f: BatchFilters): Promise<Paginated<BatchListItem>> {
  const where: Prisma.BatchWhereInput = {
    ...(f.q && { name: { contains: f.q, mode: 'insensitive' } }),
    ...(f.status && { status: f.status }),
    ...(f.courseId && { courseId: f.courseId }),
  };
  const [items, total] = await Promise.all([
    db.batch.findMany({
      where,
      include: listInclude,
      orderBy: [{ status: 'asc' }, { course: { sortOrder: 'asc' } }, { startTime: 'asc' }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    db.batch.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/** Every batch, for filters and the dashboard (small table). */
export function listAllBatches() {
  return db.batch.findMany({
    include: listInclude,
    orderBy: [{ course: { sortOrder: 'asc' } }, { startTime: 'asc' }],
  });
}

export function getBatch(id: string) {
  return db.batch.findUnique({ where: { id }, include: listInclude });
}

export function listCourses() {
  return db.course.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { batches: true, leads: true } } },
  });
}
export type CourseListItem = Awaited<ReturnType<typeof listCourses>>[number];
