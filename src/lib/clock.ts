import 'server-only';
import { db } from './db';

/** Setting written by /dev/clock to test trial expiry without waiting. Ignored in production. */
export const DEV_NOW_OFFSET_KEY = 'dev_now_offset_days';

/**
 * "Now" for business rules (trial dates, reminders, the 24 h window, nudges).
 * In dev it is shifted by the DEV_NOW_OFFSET_DAYS setting; in production it is the real time.
 * DB timestamps (createdAt, job runAt) always use real time.
 */
export async function now(): Promise<Date> {
  return new Date(Date.now() + (await devNowOffsetDays()) * 86_400_000);
}

export async function devNowOffsetDays(): Promise<number> {
  if (process.env.NODE_ENV === 'production') return 0;
  const row = await db.setting.findUnique({ where: { key: DEV_NOW_OFFSET_KEY } });
  return typeof row?.value === 'number' ? row.value : 0;
}

/** /dev/clock only. */
export async function setDevNowOffsetDays(days: number) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('The dev clock is disabled in production.');
  await db.setting.upsert({
    where: { key: DEV_NOW_OFFSET_KEY },
    create: { key: DEV_NOW_OFFSET_KEY, value: days },
    update: { value: days },
  });
}
