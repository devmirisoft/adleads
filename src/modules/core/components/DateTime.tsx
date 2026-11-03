'use client';

import {
  formatClockTime,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatRelative,
} from '../utils/dates';

/**
 * IST date-time: "14 Oct 2026, 4:30 PM", or "2 h ago" with `relative` (chat threads and inbox only).
 * `dateOnly` for calendar-date columns (trial start/end, batch dates): "14 Oct 2026".
 * Chat threads only: `timeOnly` for a bubble's corner ("4:30 PM"), `day` for a date separator ("Today").
 * Client component so reading the current time never blocks a server prerender.
 */
export function DateTime({
  value,
  relative = false,
  dateOnly = false,
  timeOnly = false,
  day = false,
}: {
  value: Date | string;
  relative?: boolean;
  dateOnly?: boolean;
  timeOnly?: boolean;
  day?: boolean;
}) {
  const iso = new Date(value).toISOString();
  const absolute = dateOnly ? formatDate(value) : formatDateTime(value);
  return (
    <time
      dateTime={iso}
      title={relative || timeOnly || day ? absolute : undefined}
      suppressHydrationWarning
    >
      {relative
        ? formatRelative(value, new Date())
        : timeOnly
          ? formatClockTime(value)
          : day
            ? formatDayLabel(value, new Date())
            : absolute}
    </time>
  );
}
