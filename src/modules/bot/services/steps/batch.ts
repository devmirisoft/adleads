import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatDays, formatTime, istDate } from '@/modules/core/utils';
import { transition } from '@/modules/leads';
import { sendList, sendText } from '@/modules/messaging';
import type { BotStep } from '../../types';
import { isUuid, replyOf, saveAnswer, sendOptions, truncate, withPrefix } from '../shared';

/** OPEN (so not full) batches of the course that haven't ended. */
async function freeBatches(courseId: string) {
  return db.batch.findMany({
    where: { courseId, status: 'OPEN', endDate: { gte: istDate(await now()) } },
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    take: 10,
  });
}

const seatsLeft = (b: { capacity: number; seatsTaken: number }) => {
  const n = b.capacity - b.seatsTaken;
  return `${n} seat${n === 1 ? '' : 's'} left`;
};

/** Step 3: list of the chosen course's batches with free seats. None → waitlist. */
export const batchStep: BotStep = {
  key: 'batch',
  async ask(ctx, opts) {
    const { lead } = ctx;
    if (!lead.courseId) throw new Error('Batch step reached without a course');
    const batches = await freeBatches(lead.courseId);
    if (batches.length === 0) {
      const course = await db.course.findUniqueOrThrow({ where: { id: lead.courseId } });
      await transition(lead.id, 'QUALIFIED', { actor: 'bot', note: 'No free batch' });
      await transition(lead.id, 'WAITLISTED', {
        actor: 'bot',
        note: `All ${course.name} batches full`,
      });
      await db.lead.update({ where: { id: lead.id }, data: { currentStep: null } });
      await sendText(
        lead.id,
        `Thanks${lead.name ? ` ${lead.name.split(' ')[0]}` : ''}! All ${course.name} batches are full right now. You're on the waitlist — we'll message you here as soon as a seat opens.`,
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
            `${formatDays(b.daysOfWeek)} · ${formatTime(b.startTime)} · ${seatsLeft(b)}`,
            72,
          ),
        })),
      },
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead }, msg) {
    const batches = await freeBatches(lead.courseId!);
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
