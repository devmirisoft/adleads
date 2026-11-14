import { AGE_DAYS, type LeadAge } from '../constants/statuses';

/** Display name: the name they gave the bot, else their WhatsApp profile name. */
export const leadName = (l: { name: string | null; profileName: string | null }) =>
  l.name ?? l.profileName ?? 'Unnamed lead';

const daysBefore = (at: Date, days: number) => new Date(at.getTime() - days * 86_400_000);

/** createdAt filter for an age tab: at least `min` days old and under `max`, so tabs never overlap. */
export function ageRange(age: LeadAge, at: Date): { lte: Date; gt?: Date } {
  const [min, max] = AGE_DAYS[age];
  return { lte: daysBefore(at, min), ...(max !== null && { gt: daysBefore(at, max) }) };
}
