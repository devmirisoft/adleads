import { formatDays, formatTime } from '@/modules/core/utils';

/** Taking trials, or will again once a seat frees up (FULL), with no link to send them. */
export const needsTrialLink = (b: { status: string; trialLink: string | null }) =>
  b.status !== 'CLOSED' && !b.trialLink;

/** "Mon–Fri · 7:00 PM–8:00 PM" */
export const batchSchedule = (b: { daysOfWeek: number[]; startTime: string; endTime: string }) =>
  `${formatDays(b.daysOfWeek)} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}`;
