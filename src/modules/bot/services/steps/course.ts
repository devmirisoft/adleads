import 'server-only';
import { db } from '@/lib/db';
import { formatMoney } from '@/modules/core/utils';
import { sendList } from '@/modules/messaging';
import type { BotStep } from '../../types';
import { handOver, replyOf, saveAnswer, sendOptions, truncate, withPrefix } from '../shared';

// ponytail: WhatsApp lists hold 10 rows; more than 10 active courses would need a second step.
const activeCourses = () =>
  db.course.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 10 });

/** Step 2: list of active courses. */
export const courseStep: BotStep = {
  key: 'course',
  async ask(ctx, opts) {
    const courses = await activeCourses();
    if (courses.length === 0) return handOver(ctx.lead);
    await sendList(
      ctx.lead.id,
      {
        body: withPrefix(ctx.question.prompt, opts?.prefix),
        button: 'Choose course',
        rows: courses.map((c) => ({
          id: c.id,
          title: truncate(c.name, 24),
          description: truncate(`${formatMoney(c.feePaise)} · ${c.description}`, 72),
        })),
      },
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead }, msg) {
    const reply = replyOf(msg);
    const course = (await activeCourses()).find(
      (c) => c.id === msg.replyId || c.name.toLowerCase() === reply,
    );
    if (!course) {
      return { result: 'retry', reason: 'Please tap "Choose course" and pick one from the list.' };
    }
    await db.lead.update({ where: { id: lead.id }, data: { courseId: course.id } });
    await saveAnswer(lead.id, 'course', course.id, course.name);
    return { result: 'next' };
  },
};
