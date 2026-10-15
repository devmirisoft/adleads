import 'server-only';
import { db } from '@/lib/db';
import { formatDays, formatMoney, formatTime } from '@/modules/core/utils';
import { sendButtons } from '@/modules/messaging';
import { getSetting } from '@/modules/settings';
import type { BotStep } from '../../types';
import { isUuid, replyOf, sendOptions, withPrefix } from '../shared';

const DEFAULT_BUTTONS = [
  { id: 'confirm', title: 'Confirm' },
  { id: 'change', title: 'Change' },
];

/** Step 4: summary + Confirm / Change. Confirm → engine books the seat; Change → back to course. */
export const confirmStep: BotStep = {
  key: 'confirm',
  async ask(ctx, opts) {
    const answers = await db.answer.findMany({ where: { leadId: ctx.lead.id } });
    const idOf = (key: string) => answers.find((a) => a.questionKey === key)?.answerValue;
    const courseId = idOf('course');
    const batchId = idOf('batch');
    const [course, batch] = await Promise.all([
      isUuid(courseId) ? db.course.findUnique({ where: { id: courseId } }) : null,
      isUuid(batchId) ? db.batch.findUnique({ where: { id: batchId } }) : null,
    ]);
    const trialDays = course?.trialDays ?? (await getSetting('default_trial_days'));
    const summary = [
      `Name: ${ctx.lead.name ?? '—'}`,
      course &&
        `Course: ${course.name} — ${formatMoney(course.feePaise)} after a ${trialDays}-day free trial`,
      batch &&
        `Batch: ${batch.name} — ${formatDays(batch.daysOfWeek)} at ${formatTime(batch.startTime)} IST`,
    ]
      .filter(Boolean)
      .join('\n');
    const options = [...ctx.question.options].sort((a, b) => a.sortOrder - b.sortOrder);
    await sendButtons(
      ctx.lead.id,
      {
        body: withPrefix(`${summary}\n\n${ctx.question.prompt}`, opts?.prefix),
        buttons: options.length
          ? options.slice(0, 3).map((o) => ({ id: o.value, title: o.label }))
          : DEFAULT_BUTTONS,
      },
      sendOptions(ctx, opts),
    );
  },
  async handle(_ctx, msg) {
    const reply = replyOf(msg);
    if (reply === 'confirm' || reply === 'yes') return { result: 'next' };
    if (reply === 'change') return { result: 'goto', step: 'course' };
    return {
      result: 'retry',
      reason: 'Please tap Confirm to book your free trial, or Change to pick again.',
    };
  },
};
