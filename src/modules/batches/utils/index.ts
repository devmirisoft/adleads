import { formatDays, formatTime } from '@/modules/core/utils';

/** "Mon–Fri · 7:00 PM–8:00 PM" */
export const batchSchedule = (b: { daysOfWeek: number[]; startTime: string; endTime: string }) =>
  `${formatDays(b.daysOfWeek)} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}`;
