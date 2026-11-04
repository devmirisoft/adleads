'use server';
import 'server-only';
import { z } from 'zod';
import { CAN_ACT, guarded } from '@/modules/auth';
import { TEMPLATE_NAMES, type TemplateName } from '../constants/templates';
import { toChatMessage } from './inbound';
import { OutsideWindowError, sendTemplate, sendText } from './send';

const uuid = z.uuid();

async function orExplain<T>(p: Promise<T | null>): Promise<T> {
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

// Both actions return the QUEUED row straight away; the thread's polling carries the ticks from
// there, so the page itself doesn't need refreshing.

/** Staff free-form reply (only inside the 24 h window). `messageId` is the client's optimistic id. */
export async function sendReply(id: string, text: string, messageId: string) {
  return guarded(
    CAN_ACT,
    async (user) => {
      const body = z.string().trim().min(1, 'Type a message first').max(4096).parse(text);
      const opts = { sentBy: user.id, id: uuid.parse(messageId), background: true };
      return toChatMessage(await orExplain(sendText(uuid.parse(id), body, opts)));
    },
    { refresh: false },
  );
}

/** Staff-sent approved template (works any time). `messageId` is the client's optimistic id. */
export async function sendTemplateReply(
  id: string,
  name: TemplateName,
  vars: Record<string, string>,
  messageId: string,
) {
  return guarded(
    CAN_ACT,
    async (user) => {
      const template = z.enum(TEMPLATE_NAMES as [TemplateName, ...TemplateName[]]).parse(name);
      const opts = { sentBy: user.id, id: uuid.parse(messageId), background: true };
      // sendTemplate validates vars against the template.
      const sent = await orExplain(sendTemplate(uuid.parse(id), template, vars as never, opts));
      return toChatMessage(sent);
    },
    { refresh: false },
  );
}
