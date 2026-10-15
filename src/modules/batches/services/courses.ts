import 'server-only';
import { db } from '@/lib/db';
import { courseInputSchema, type CourseInput } from '../types';

const toData = (input: CourseInput) => {
  const { feeRupees, ...c } = courseInputSchema.parse(input);
  return { ...c, feePaise: Math.round(feeRupees * 100) };
};

export function createCourse(input: CourseInput) {
  return db.course.create({ data: toData(input) });
}

export function updateCourse(id: string, input: CourseInput) {
  return db.course.update({ where: { id }, data: toData(input) });
}

/** Only courses nobody has used yet can be deleted; otherwise switch them off (isActive). */
export async function deleteCourse(id: string) {
  const used = await db.course.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { batches: true, leads: true } } },
  });
  if (used._count.batches || used._count.leads) {
    throw new Error('This course has batches or leads. Turn off “Active” instead of deleting it.');
  }
  await db.course.delete({ where: { id } });
}
