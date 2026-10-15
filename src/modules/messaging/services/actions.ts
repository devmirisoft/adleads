'use server';
import 'server-only';
import { z } from 'zod';
import { CAN_ACT, guarded } from '@/modules/auth';
import { TEMPLATE_NAMES, type TemplateName } from '../constants/templates';
import { OutsideWindowError, sendTemplate, sendText } from './send';

const leadId = z.uuid();

async function orExplain<T>(p: Promise<T>) {
  try {
    const sent = await p;
    if (sent === null) throw new Error('This lead opted out, so nothing was sent.');
    return sent;
  } catch (e) {
    if (e instanceof OutsideWindowError) {
      throw new Error(
        "It's been more than 24 hours since they last wrote. Send a template instead.",
      );
    }
    throw e;
  }
}

/** Staff free-form reply (only inside the 24 h window). */
export async function sendReply(id: string, text: string) {
  return guarded(CAN_ACT, async (user) => {
    const body = z.string().trim().min(1, 'Type a message first').max(4096).parse(text);
    await orExplain(sendText(leadId.parse(id), body, { sentBy: user.id }));
    return null;
  });
}

/** Staff-sent approved template (works any time). */
export async function sendTemplateReply(
  id: string,
  name: TemplateName,
  vars: Record<string, string>,
) {
  return guarded(CAN_ACT, async (user) => {
    const template = z.enum(TEMPLATE_NAMES as [TemplateName, ...TemplateName[]]).parse(name);
    // sendTemplate validates vars against the template.
    await orExplain(sendTemplate(leadId.parse(id), template, vars as never, { sentBy: user.id }));
    return null;
  });
}
