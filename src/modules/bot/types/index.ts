import { z } from 'zod';
import type { Lead, Question, QuestionOption } from '@/generated/prisma/client';
import type { InboundMessage } from '@/modules/messaging';

export type StepKey = 'name' | 'course' | 'batch' | 'confirm';

export type StepResult =
  | { result: 'next' }
  /** Invalid answer: re-ask with this hint (a second miss in a row hands over to a human). */
  | { result: 'retry'; reason: string }
  | { result: 'goto'; step: StepKey }
  /** The step finished the conversation itself (e.g. waitlisted). */
  | { result: 'done' };

export type StepContext = { lead: Lead; question: Question & { options: QuestionOption[] } };

export type AskOptions = {
  /** Shown before the prompt, e.g. the welcome text, a nudge or a hint. */
  prefix?: string;
  /** Marks the message as a re-ask after an invalid answer. */
  retry?: boolean;
  sentBy?: 'bot' | 'cron';
};

export interface BotStep {
  key: StepKey;
  ask(ctx: StepContext, opts?: AskOptions): Promise<void>;
  handle(ctx: StepContext, msg: InboundMessage): Promise<StepResult>;
}

/** Shared by the question editor and its action. Option values stay fixed — the bot logic keys on them. */
export const questionUpdateSchema = z.object({
  prompt: z.string().trim().min(1, 'Write the question').max(900, 'Keep it under 900 characters'),
  isActive: z.boolean(),
  options: z.array(
    z.object({
      id: z.uuid(),
      label: z
        .string()
        .trim()
        .min(1, 'Label can’t be empty')
        .max(20, 'WhatsApp buttons fit 20 characters'),
    }),
  ),
});
export type QuestionUpdate = z.infer<typeof questionUpdateSchema>;
