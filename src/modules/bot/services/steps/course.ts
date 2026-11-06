import 'server-only';
import { db } from '@/lib/db';
import { formatMoney } from '@/modules/core/utils';
import { listableCourses } from '@/modules/enrollments';
import { sendList } from '@/modules/messaging';
import type { BotStep } from '../../types';
import { pickOption } from '../../utils';
import { handOver, saveAnswer, sendOptions, truncate, withPrefix } from '../shared';

/** Step 2: list of active courses with a batch that isn't closed or over. */
export const courseStep: BotStep = {
  key: 'course',
  async ask(ctx, opts) {
    const courses = await listableCourses();
    if (courses.length === 0) return handOver(ctx.lead);
    await sendList(
      ctx.lead.id,
      {
        body: withPrefix(ctx.question.prompt, opts?.prefix),
        button: 'Choose course',
        rows: courses.map((c) => ({
          id: c.id,
          title: truncate(c.name, 24),
          description: truncate(
            `${c.waitlistOnly ? 'Waitlist only · ' : ''}${formatMoney(c.feePaise)} · ${c.description}`,
            72,
          ),
        })),
      },
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead }, msg) {
    const course = pickOption(await listableCourses(), msg);
    if (!course) {
      return { result: 'retry', reason: 'Please tap "Choose course" and pick one from the list.' };
    }
    await db.lead.update({ where: { id: lead.id }, data: { courseId: course.id } });
    await saveAnswer(lead.id, 'course', course.id, course.name);
    // A batch picked earlier belongs to the old choice: keeping it could book the wrong course.
    await db.answer.deleteMany({ where: { leadId: lead.id, questionKey: 'batch' } });
    return { result: 'next' };
  },
};
