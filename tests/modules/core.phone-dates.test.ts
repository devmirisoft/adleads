import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/modules/core/utils/phone';
import {
  addTrialDays,
  formatDays,
  formatTime,
  isWithin24h,
  istDate,
} from '@/modules/core/utils/dates';

describe('normalizePhone', () => {
  it.each([
    ['98123 45678', '+919812345678'],
    ['098123-45678', '+919812345678'],
    ['+91 98123 45678', '+919812345678'],
    ['919812345678', '+919812345678'],
    ['+1 415 555 0123', '+14155550123'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(['', '12345', 'abc', '0000000000'])('rejects %j', (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );
});

describe('dates', () => {
  it('istDate uses the IST calendar day', () => {
    // 20:00 UTC on 14 Oct = 01:30 IST on 15 Oct
    expect(istDate(new Date('2026-10-14T20:00:00Z')).toISOString()).toBe(
      '2026-10-15T00:00:00.000Z',
    );
  });

  it('a 3-day trial starting Monday ends Wednesday', () => {
    expect(addTrialDays(new Date('2026-10-12'), 3).toISOString().slice(0, 10)).toBe('2026-10-14');
  });

  it('24 h window', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(isWithin24h(new Date('2026-10-13T12:00:01Z'), now)).toBe(true);
    expect(isWithin24h(new Date('2026-10-13T12:00:00Z'), now)).toBe(false);
    expect(isWithin24h(null, now)).toBe(false);
  });

  it('formats batch days and times', () => {
    expect(formatDays([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(formatDays([7, 6])).toBe('Sat, Sun');
    expect(formatDays([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(formatTime('19:00')).toBe('7:00 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatTime('12:05')).toBe('12:05 PM');
  });
});
