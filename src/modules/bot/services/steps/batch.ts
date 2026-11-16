import 'server-only';
import type { Batch } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { formatDays, formatTime } from '@/modules/core/utils';
import { bookableBatches } from '@/modules/enrollments';
import { transition } from '@/modules/leads';
import { sendList, sendText } from '@/modules/messaging';
import { getMessage } from '@/modules/settings';
import type { BotStep } from '../../types';
import { pickOption } from '../../utils';
import { isUuid, saveAnswer, sendOptions, truncate, withPrefix } from '../shared';

/** The list the lead taps through. The Bot script page previews this same list. */
export const batchList = (batches: Batch[]) => ({
  button: 'Choose batch',
  rows: batches.map((b) => ({
    id: b.id,
    title: truncate(b.name, 24),
    description: truncate(`${formatDays(b.daysOfWeek)} · ${formatTime(b.startTime)}`, 72),
  })),
});

/** Step 3: list of the chosen course's open batches. None (all closed or ended since) → waitlist. */
export const batchStep: BotStep = {
  key: 'batch',
  async ask(ctx, opts) {
    const { lead } = ctx;
    if (!lead.courseId) throw new Error('Batch step reached without a course');
    const batches = await bookableBatches(lead.courseId);
    if (batches.length === 0) {
      const course = await db.course.findUniqueOrThrow({ where: { id: lead.courseId } });
      await transition(lead.id, 'QUALIFIED', { actor: 'bot', note: 'No open batch' });
      await transition(lead.id, 'WAITLISTED', {
        actor: 'bot',
        note: `No open batch in ${course.name}`,
      });
      await db.lead.update({ where: { id: lead.id }, data: { currentStep: null } });
      await sendText(lead.id, await getMessage('msg_no_seats', { where: course.name }), {
        sentBy: opts?.sentBy ?? 'bot',
      });
      return;
    }
    await sendList(
      lead.id,
      { body: withPrefix(ctx.question.prompt, opts?.prefix), ...batchList(batches) },
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead }, msg) {
    const batch = pickOption(await bookableBatches(lead.courseId!), msg);
    if (batch) {
      await saveAnswer(lead.id, 'batch', batch.id, batch.name);
      return { result: 'next' };
    }
    const gone = isUuid(msg.replyId) && (await db.batch.findUnique({ where: { id: msg.replyId } }));
    return {
      result: 'retry',
      reason: gone
        ? 'Sorry, that batch just closed. Please pick another one.'
        : 'Please tap "Choose batch" and pick one from the list, or reply CHANGE to pick another course.',
    };
  },
};
