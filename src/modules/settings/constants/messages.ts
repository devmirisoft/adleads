import { z } from 'zod';

type BotMessageDef = {
  title: string;
  /** When the bot sends it, shown under the title in the editor. */
  when: string;
  /** Placeholders the sender fills in, written as {name} in the text. */
  vars: readonly string[];
  /** Placeholders that must stay: without {link} the lead never gets the link. */
  required?: readonly string[];
  default: string;
};

const CHANGE_HINT = 'Reply CHANGE to pick a different course or batch.';

/**
 * Fixed bot replies staff can edit on the Bot script page. Stored in the settings table under
 * these keys; a missing row means the default. WhatsApp templates (sent outside the 24 h window)
 * are approved by Meta and aren't edited here.
 */
export const BOT_MESSAGES = {
  welcome_text: {
    title: 'Welcome',
    when: 'Sent to a new lead, just before the first question.',
    vars: [],
    default: 'Hi! Thanks for your interest in our live online classes.',
  },
  msg_seat_booked: {
    title: 'Seat booked',
    when: 'After the lead confirms and their trial seat is booked.',
    vars: ['name', 'batch'],
    default: 'Great, your seat is booked! Your class link is on its way.',
  },
  msg_trial_link: {
    title: 'Trial link',
    when: 'Right after the seat is booked, with the batch’s trial link.',
    vars: ['name', 'batch', 'when', 'trial_start', 'trial_end', 'link'],
    required: ['link'],
    default: `You're booked, {name}! Your free trial of {batch} ({when}) runs {trial_start} – {trial_end}.\n\nThis link is for your trial days: {link}\n\nYou'll get your regular class link after payment.`,
  },
  msg_invite: {
    title: 'Invite a friend',
    when: 'Right after the first trial link, if the lead is still in the 24 h window. {link} opens WhatsApp so they can send an invite to a contact. Not sent until the business WhatsApp number is set up (WA_DISPLAY_NUMBER).',
    vars: ['name', 'link'],
    required: ['link'],
    default: "Know someone who'd enjoy these classes? Tap here to invite them on WhatsApp: {link}",
  },
  msg_paid_link: {
    title: 'Paid class link',
    when: 'Once payment is confirmed, with the batch’s paid link.',
    vars: ['name', 'batch', 'when', 'link'],
    required: ['link'],
    default: "Here's your class link for {batch} ({when}): {link}",
  },
  msg_link_changed: {
    title: 'Link changed',
    when: 'When staff change a batch’s link and choose to send the new one.',
    vars: ['name', 'batch', 'link'],
    required: ['link'],
    default:
      'Hi {name}, the link for your {batch} classes has changed. Please use this one from now on: {link}',
  },
  msg_no_seats: {
    title: 'No seats',
    when: 'The chosen course or batch has nothing open to book. The lead is waitlisted.',
    vars: ['where'],
    default: `Sorry! There are currently no available seats in {where}. Our team will follow up with you.\n\n${CHANGE_HINT}`,
  },
  msg_waitlist: {
    title: 'On the waitlist',
    when: 'A waitlisted lead writes in without booking an offered seat.',
    vars: [],
    default: `You're on our waitlist. Our team will follow up with you.\n\n${CHANGE_HINT}`,
  },
  msg_link_coming: {
    title: 'Link coming',
    when: 'The chosen batch has no trial link yet, so staff will book the seat.',
    vars: [],
    default: `Our team will send your class link shortly.\n\n${CHANGE_HINT}`,
  },
  msg_trial_used: {
    title: 'Already had a trial',
    when: 'The lead tries to book again after their one free trial. The chat goes to staff.',
    vars: [],
    default:
      "You've already used your free trial with us. Someone from our team will reply here about joining a batch.",
  },
  msg_handed_over: {
    title: 'Handed to staff',
    when: 'The bot can’t help (HELP, an unexpected question…) and flags the chat for staff.',
    vars: [],
    default: 'Thanks for your message! Someone from our team will reply here soon.',
  },
  msg_stuck: {
    title: 'Stuck hint',
    when: 'Added to a question asked again after two wrong answers in a row.',
    vars: [],
    default: 'Stuck? Reply HELP and someone from our team will reply here.',
  },
} as const satisfies Record<string, BotMessageDef>;

export type BotMessageKey = keyof typeof BOT_MESSAGES;
export const BOT_MESSAGE_KEYS = Object.keys(BOT_MESSAGES) as BotMessageKey[];

/** "{name}" → vars.name. Unknown placeholders stay as typed, so a typo is visible, not blank. */
export const fillMessage = (text: string, vars: Record<string, string> = {}) =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);

/** The message editor form, shared with its server action. */
export const botMessageSchema = z
  .object({
    key: z.enum(BOT_MESSAGE_KEYS as [BotMessageKey, ...BotMessageKey[]]),
    text: z.string().trim().min(1, 'Write the message').max(500, 'Keep it under 500 characters'),
  })
  .superRefine(({ key, text }, ctx) => {
    const def: BotMessageDef = BOT_MESSAGES[key];
    for (const v of def.required ?? []) {
      if (!text.includes(`{${v}}`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: `Keep {${v}} in the message, or the lead won't get it.`,
        });
      }
    }
  });
export type BotMessageInput = z.infer<typeof botMessageSchema>;
