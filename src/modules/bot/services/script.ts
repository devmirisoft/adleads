import 'server-only';
import { db } from '@/lib/db';
import { bookableBatches, listableCourses } from '@/modules/enrollments';
import { questionUpdateSchema, type QuestionUpdate } from '../types';
import { batchList } from './steps/batch';
import { courseList } from './steps/course';

export function listQuestions() {
  return db.question.findMany({
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { step: 'asc' },
  });
}
export type ScriptQuestion = Awaited<ReturnType<typeof listQuestions>>[number];

export async function updateQuestion(id: string, input: QuestionUpdate) {
  const q = questionUpdateSchema.parse(input);
  const current = await db.question.findUniqueOrThrow({
    where: { id },
    include: { options: true },
  });
  if (!q.isActive && current.key !== 'confirm') {
    throw new Error(
      'Name, course and batch are needed to book a trial — only the confirm step can be switched off.',
    );
  }
  const labels = q.options.map((o) => o.label.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new Error('Option labels must be different.');
  await db.$transaction([
    db.question.update({ where: { id }, data: { prompt: q.prompt, isActive: q.isActive } }),
    ...q.options
      .filter((o) => current.options.some((c) => c.id === o.id))
      .map((o) => db.questionOption.update({ where: { id: o.id }, data: { label: o.label } })),
  ]);
}

export type OptionsPreview = {
  button: string;
  groups: { heading?: string; rows: { title: string; description: string }[] }[];
};

/**
 * The lists the course and batch questions would send right now, built by the same code the bot
 * uses. Batches depend on the course picked, so there's one group per course.
 */
export async function scriptPreview(): Promise<Record<'course' | 'batch', OptionsPreview>> {
  const courses = await listableCourses();
  const batches = await Promise.all(courses.map((c) => bookableBatches(c.id)));
  const { button, rows } = courseList(courses);
  return {
    course: { button, groups: courses.length ? [{ rows }] : [] },
    batch: {
      button: batchList([]).button,
      groups: courses.map((c, i) => ({
        heading: `If they pick ${c.name}`,
        rows: batchList(batches[i]).rows,
      })),
    },
  };
}
