import 'server-only';
import { db } from '@/lib/db';
import { formatDays, formatTime } from '@/modules/core/utils';
import { bookableBatches } from '@/modules/enrollments';
import { transition } from '@/modules/leads';
import { sendList, sendText } from '@/modules/messaging';
import type { BotStep } from '../../types';
import { isUuid, noSeats, replyOf, saveAnswer, sendOptions, truncate, withPrefix } from '../shared';

const seatsLabel = (n: number) => `${n} seat${n === 1 ? '' : 's'} left`;

/** Step 3: list of the chosen course's batches with free seats. None → waitlist. */
export const batchStep: BotStep = {
  key: 'batch',
  async ask(ctx, opts) {
    const { lead } = ctx;
    if (!lead.courseId) throw new Error('Batch step reached without a course');
    const batches = await bookableBatches(lead.courseId);
    if (batches.length === 0) {
      const course = await db.course.findUniqueOrThrow({ where: { id: lead.courseId } });
      await transition(lead.id, 'QUALIFIED', { actor: 'bot', note: 'No free batch' });
      await transition(lead.id, 'WAITLISTED', {
        actor: 'bot',
        note: `No seats in ${course.name}`,
      });
      await db.lead.update({ where: { id: lead.id }, data: { currentStep: null } });
      await sendText(
        lead.id,
        `Thanks${lead.name ? ` ${lead.name.split(' ')[0]}` : ''}! ${noSeats(course.name)}`,
        { sentBy: opts?.sentBy ?? 'bot' },
      );
      return;
    }
    await sendList(
      lead.id,
      {
        body: withPrefix(ctx.question.prompt, opts?.prefix),
        button: 'Choose batch',
        rows: batches.map((b) => ({
          id: b.id,
          title: truncate(b.name, 24),
          description: truncate(
            `${formatDays(b.daysOfWeek)} · ${formatTime(b.startTime)} · ${seatsLabel(b.seatsLeft)}`,
            72,
          ),
        })),
      },
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead }, msg) {
    const batches = await bookableBatches(lead.courseId!);
    const reply = replyOf(msg);
    const batch = batches.find((b) => b.id === msg.replyId || b.name.toLowerCase() === reply);
    if (batch) {
      await saveAnswer(lead.id, 'batch', batch.id, batch.name);
      return { result: 'next' };
    }
    const filled =
      isUuid(msg.replyId) && (await db.batch.findUnique({ where: { id: msg.replyId } }));
    return {
      result: 'retry',
      reason: filled
        ? 'Sorry, that batch just filled up. Please pick another one.'
        : 'Please tap "Choose batch" and pick one from the list.',
    };
  },
};
