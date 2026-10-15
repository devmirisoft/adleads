import 'server-only';
import { db } from '@/lib/db';
import { sendText } from '@/modules/messaging';
import type { BotStep } from '../../types';
import { saveAnswer, sendOptions, withPrefix } from '../shared';

const DEFAULT_NAME = /^[\p{L}\p{M} ]{2,60}$/u;

/** Step 1: free-text name — letters and spaces, 2–60 characters. */
export const nameStep: BotStep = {
  key: 'name',
  async ask(ctx, opts) {
    await sendText(
      ctx.lead.id,
      withPrefix(ctx.question.prompt, opts?.prefix),
      sendOptions(ctx, opts),
    );
  },
  async handle({ lead, question }, msg) {
    const name = (msg.kind === 'text' ? (msg.text ?? '') : '').trim().replace(/\s+/g, ' ');
    const pattern = question.validationRegex
      ? new RegExp(question.validationRegex, 'u')
      : DEFAULT_NAME;
    if (!pattern.test(name)) {
      return {
        result: 'retry',
        reason: 'Please reply with just your full name, using letters only (2–60 characters).',
      };
    }
    await db.lead.update({ where: { id: lead.id }, data: { name } });
    await saveAnswer(lead.id, 'name', name, name);
    return { result: 'next' };
  },
};
