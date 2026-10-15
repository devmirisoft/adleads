import { z } from 'zod';
import type { ChatButton } from '../types';

// Pre-approved WhatsApp templates: the only messages allowed outside the 24 h window.
// `params` must match the {{1}}, {{2}}… order of the template approved in Meta Business Manager;
// `preview` is our copy of its text, stored with the message so chat threads read naturally.

const s = z.string().min(1);

function template<V extends z.ZodObject>(def: {
  vars: V;
  params: (v: z.infer<V>) => string[];
  preview: (v: z.infer<V>) => string;
  /** Quick-reply buttons defined on the approved template. */
  buttons?: ChatButton[];
}) {
  return def;
}

export const TEMPLATES = {
  class_reminder: template({
    vars: z.object({ name: s, batch: s, when: s, joinUrl: s }),
    params: (v) => [v.name, v.batch, v.when, v.joinUrl],
    preview: (v) =>
      `Hi ${v.name}, your ${v.batch} class is ${v.when}. Join with your personal link: ${v.joinUrl}`,
  }),
  trial_payment_reminder: template({
    vars: z.object({ name: s, course: s, trialEnd: s, amount: s, payUrl: s }),
    params: (v) => [v.name, v.course, v.trialEnd, v.amount, v.payUrl],
    preview: (v) =>
      `Hi ${v.name}, your free trial of ${v.course} ends on ${v.trialEnd}. Pay ${v.amount} to keep your seat: ${v.payUrl}`,
  }),
  trial_last_day: template({
    vars: z.object({ name: s, payUrl: s }),
    params: (v) => [v.name, v.payUrl],
    preview: (v) =>
      `Hi ${v.name}, today is the last day of your free trial. Pay here to keep your seat: ${v.payUrl}`,
  }),
  enrollment_confirmed: template({
    vars: z.object({ name: s, batch: s, joinUrl: s }),
    params: (v) => [v.name, v.batch, v.joinUrl],
    preview: (v) =>
      `Thank you ${v.name}! You're enrolled in ${v.batch}. Your class link: ${v.joinUrl}`,
  }),
  trial_ended: template({
    vars: z.object({ name: s }),
    params: (v) => [v.name],
    preview: (v) =>
      `Hi ${v.name}, your free trial has ended and your class link is no longer active. Reply to this message if you'd like to join.`,
  }),
  waitlist_seat_open: template({
    vars: z.object({ name: s, batch: s }),
    params: (v) => [v.name, v.batch],
    preview: (v) => `Good news ${v.name}! A seat opened up in ${v.batch}. Tap below to book it.`,
    buttons: [{ id: 'book_seat', title: 'Book my seat' }],
  }),
};

export type TemplateName = keyof typeof TEMPLATES;
export type TemplateVars<N extends TemplateName> = z.infer<(typeof TEMPLATES)[N]['vars']>;
export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];
