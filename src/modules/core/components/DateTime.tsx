'use client';

import { formatDate, formatDateTime, formatRelative } from '../utils/dates';

/**
 * IST date-time: "14 Oct 2026, 4:30 PM", or "2 h ago" with `relative` (chat threads and inbox only).
 * `dateOnly` for calendar-date columns (trial start/end, batch dates): "14 Oct 2026".
 * Client component so reading the current time never blocks a server prerender.
 */
export function DateTime({
  value,
  relative = false,
  dateOnly = false,
}: {
  value: Date | string;
  relative?: boolean;
  dateOnly?: boolean;
}) {
  const iso = new Date(value).toISOString();
  const absolute = dateOnly ? formatDate(value) : formatDateTime(value);
  return (
    <time dateTime={iso} title={relative ? absolute : undefined} suppressHydrationWarning>
      {relative ? formatRelative(value, new Date()) : absolute}
    </time>
  );
}
