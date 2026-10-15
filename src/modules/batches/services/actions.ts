'use server';
import 'server-only';
import { z } from 'zod';
import { ADMIN_ONLY, guarded } from '@/modules/auth';
import type { BatchInput, CourseInput } from '../types';
import { closeBatch, createBatch, updateBatch } from './batches';
import { createCourse, deleteCourse, updateCourse } from './courses';

const id = z.uuid();

export async function saveBatchAction(batchId: string | null, input: BatchInput) {
  return guarded(ADMIN_ONLY, async () => {
    const b = batchId ? await updateBatch(id.parse(batchId), input) : await createBatch(input);
    return b.id;
  });
}

export async function closeBatchAction(batchId: string) {
  return guarded(ADMIN_ONLY, async () => {
    await closeBatch(id.parse(batchId));
    return null;
  });
}

export async function saveCourseAction(courseId: string | null, input: CourseInput) {
  return guarded(ADMIN_ONLY, async () => {
    const c = courseId ? await updateCourse(id.parse(courseId), input) : await createCourse(input);
    return c.id;
  });
}

export async function deleteCourseAction(courseId: string) {
  return guarded(ADMIN_ONLY, async () => {
    await deleteCourse(id.parse(courseId));
    return null;
  });
}
