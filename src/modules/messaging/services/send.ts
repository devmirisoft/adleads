import 'server-only';
import { after } from 'next/server';
import type { Message, MessageType } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { whatsapp, type Button, type ListRow, type SendResult } from '@/lib/whatsapp/client';
import { TEMPLATES, type TemplateName, type TemplateVars } from '../constants/templates';
import type { MessageBody } from '../types';
import { publishMessage } from './events';
import { isWindowOpen } from './window';

// The ONLY way to message a lead. Never sends to opted-out leads, refuses free-form
// messages outside the 24 h window, and logs every attempt to `messages`.

export class OutsideWindowError extends Error {
  name = 'OutsideWindowError';
  constructor() {
    super('More than 24 hours since the lead last wrote — only a template can be sent.');
  }
}

export type SendOptions = {
  /** "bot" | "cron" | a user id */
  sentBy: string;
  /** Bot bookkeeping: marks a re-ask of step N after an invalid answer. */
  retryStep?: number;
  /** Staff thread: matches the saved row to the browser's optimistic bubble. */
  clientId?: string;
  /**
   * Resolve with the QUEUED row now and call Meta after the response. A send failure then shows
   * as status FAILED, not as a rejection. Needs a request (server action or route handler).
   */
  background?: boolean;
};

async function deliver(
  leadId: string,
  msg: { type: MessageType; body: MessageBody; templateName?: string },
  call: (to: string) => Promise<SendResult>,
  { sentBy, retryStep, clientId, background }: SendOptions,
): Promise<Message | null> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { phoneE164: true, optedOutAt: true, lastInboundAt: true },
  });
  if (lead.optedOutAt) return null; // opted out: never send, nothing to log
  if (msg.type !== 'TEMPLATE' && !(await isWindowOpen(lead))) throw new OutsideWindowError();

  const row = await db.message.create({
    data: {
      leadId,
      direction: 'OUT',
      type: msg.type,
      templateName: msg.templateName,
      body: { ...msg.body, retryStep, clientId },
      status: 'QUEUED',
      sentBy,
    },
  });
  // Runs alongside the Meta call so the push never delays a send, and always lands before the
  // status event, so browsers see the row before its ticks.
  const created = publishMessage('message.created', row);
  const dispatch = async () => {
    try {
      const { waMessageId } = await call(lead.phoneE164.slice(1)); // WhatsApp wants digits, no "+"
      const sent = await db.message.update({
        where: { id: row.id },
        data: { status: 'SENT', waMessageId },
      });
      await created;
      await publishMessage('message.status', sent);
      return sent;
    } catch (e) {
      const errorCode =
        e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 500) : 'Unknown error';
      const failed = await db.message.update({
        where: { id: row.id },
        data: { status: 'FAILED', errorCode },
      });
      await db.lead.update({ where: { id: leadId }, data: { needsHuman: true } }); // puts it in /inbox
      await created;
      await publishMessage('message.status', failed);
      throw e;
    }
  };
  if (!background) return dispatch();
  // ponytail: a process killed before this finishes leaves the row QUEUED (clock icon) for good.
  // If that's ever seen, have cron mark old QUEUED rows FAILED, or move this onto the jobs queue.
  after(() =>
    dispatch().catch((e: unknown) =>
      console.error('[send] background send failed', e instanceof Error ? e.name : 'unknown'),
    ),
  );
  return row;
}

// Each resolves to the logged Message, or null if the lead has opted out (nothing sent).

export function sendText(leadId: string, text: string, opts: SendOptions) {
  return deliver(
    leadId,
    { type: 'TEXT', body: { text } },
    (to) => whatsapp.sendText(to, text),
    opts,
  );
}

export function sendButtons(
  leadId: string,
  msg: { body: string; buttons: Button[] },
  opts: SendOptions,
) {
  return deliver(
    leadId,
    { type: 'INTERACTIVE', body: { text: msg.body, buttons: msg.buttons } },
    (to) => whatsapp.sendButtons(to, msg),
    opts,
  );
}

export function sendList(
  leadId: string,
  msg: { body: string; button: string; rows: ListRow[] },
  opts: SendOptions,
) {
  return deliver(
    leadId,
    { type: 'INTERACTIVE', body: { text: msg.body, button: msg.button, rows: msg.rows } },
    (to) => whatsapp.sendList(to, msg),
    opts,
  );
}

export function sendTemplate<N extends TemplateName>(
  leadId: string,
  name: N,
  vars: TemplateVars<N>,
  opts: SendOptions,
) {
  const t = TEMPLATES[name];
  // Re-validate: job payloads arrive as untyped JSON. (Cast: TS can't narrow t by generic N.)
  const v = t.vars.parse(vars) as never;
  const params = t.params(v);
  const buttons = 'buttons' in t ? t.buttons : undefined;
  return deliver(
    leadId,
    {
      type: 'TEMPLATE',
      templateName: name,
      body: { name, language: 'en', params, text: t.preview(v), buttons },
    },
    (to) => whatsapp.sendTemplate(to, name, 'en', params),
    opts,
  );
}

/**
 * Blue ticks on the lead's latest message; with `typing`, also their "typing…" bubble. Goes through
 * the adapter, so it's a no-op unless WhatsApp is live. Best effort: a failed receipt must never
 * stop a reply, so it logs and resolves. Not for opted-out leads.
 */
async function acknowledge(leadId: string, typing: boolean): Promise<void> {
  const latest = await db.message.findFirst({
    where: { leadId, direction: 'IN', waMessageId: { not: null }, lead: { optedOutAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { waMessageId: true },
  });
  if (!latest?.waMessageId) return;
  try {
    await whatsapp.markRead(latest.waMessageId, { typing });
  } catch (e) {
    console.warn('[wa] read receipt failed', e instanceof Error ? e.name : 'unknown');
  }
}

export const markInboundRead = (leadId: string) => acknowledge(leadId, false);
export const showTyping = (leadId: string) => acknowledge(leadId, true);
