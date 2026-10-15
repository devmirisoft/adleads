// IST helpers and trial date maths. Pure: callers pass "now" (server code gets it from @/lib/clock).
import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '../constants';

const DAY = 86_400_000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "14 Oct 2026, 4:30 PM" in IST. */
export function formatDateTime(value: Date | string): string {
  return formatInTimeZone(value, APP_TIMEZONE, 'd MMM yyyy, h:mm a');
}

/** "14 Oct 2026" for date-only columns (stored as UTC midnight of the IST date). */
export function formatDate(value: Date | string): string {
  return formatInTimeZone(value, 'UTC', 'd MMM yyyy');
}

/** "just now", "5 min ago", "2 h ago", "3 d ago"; older than a week falls back to the date. */
export function formatRelative(value: Date | string, now: Date): string {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} d ago`;
  return formatInTimeZone(value, APP_TIMEZONE, 'd MMM yyyy');
}

/** The IST calendar date of `now`, as UTC midnight — the form @db.Date columns use. */
export function istDate(now: Date): Date {
  return new Date(formatInTimeZone(now, APP_TIMEZONE, 'yyyy-MM-dd'));
}

/** Date-only arithmetic on UTC-midnight dates. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** Last day of a `days`-day trial starting on `start` (inclusive): 3 days from Mon → Wed. */
export function addTrialDays(start: Date, days: number): Date {
  return addDays(start, days - 1);
}

/** WhatsApp's customer-service window: free-form messages allowed for 24 h after the lead's last message. */
export function isWithin24h(lastInboundAt: Date | null | undefined, now: Date): boolean {
  return !!lastInboundAt && now.getTime() - lastInboundAt.getTime() < DAY;
}

/** ISO weekday of a UTC-midnight date: 1 = Mon … 7 = Sun. */
export function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/** [1,2,3,4,5] → "Mon–Fri", [6,7] → "Sat, Sun", [1,3,5] → "Mon, Wed, Fri". */
export function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length >= 3) {
    return `${WEEKDAYS[sorted[0] - 1]}–${WEEKDAYS[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((d) => WEEKDAYS[d - 1]).join(', ');
}

/** "19:00" → "7:00 PM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
