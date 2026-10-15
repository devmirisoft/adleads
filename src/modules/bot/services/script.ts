import 'server-only';
import { questionUpdateSchema, type QuestionUpdate } from '../types';
import { db } from '@/lib/db';

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
